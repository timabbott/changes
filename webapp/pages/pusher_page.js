import React, { PropTypes } from 'react';

import ChangesLinks from 'es6!display/changes/links';
import { ChangesPage, APINotLoadedPage } from 'es6!display/page_chrome';
import { Grid } from 'es6!display/grid';
import { SingleBuildStatus } from 'es6!display/changes/builds';
import { TimeText, display_duration_pieces } from 'es6!display/time';
import { WaitingLiveText } from 'es6!display/changes/build_text';
import { get_runnable_condition, get_runnable_condition_color_cls } from 'es6!display/changes/build_conditions';

import * as api from 'es6!server/api';

import * as utils from 'es6!utils/utils';

// how often to hit the api server for updates
var POLL_INTERVAL = 10000;

/*
 * Valid query params: main (multiple times), aux, auxWidth.
 *
 * How to use:
 * - The first main parameter determines the list of commits to show.
 *   Additional main parameters will show latest builds for that commit.
 * - A parameter can be just a project slug, or slug::branch.
 * - aux creates a separate column on the right with a unique set of commits
 *   and the build result for that commit.
 * - auxWidth: percentage width of the aux column
 */
var PusherPage = React.createClass({

  getInitialTitle: function() {
    return 'Dashboard';
  },

  getInitialState: function() {
    var endpoints = this.getEndpoints();

    var state = {};
    _.each(_.keys(endpoints), key => {
      state[key] = null;
    });
    return state;
  },

  componentDidMount: function() {
    api.fetch(this, this.getEndpoints());

    this.updateInProgress = false;
    this.refreshTimer = window.setInterval(__ => {
      if (!this.isMounted()) {
        return;
      }
      this.liveUpdate();
    }, POLL_INTERVAL);
  },

  render: function() {
    if (this.updateInProgress) {
      if (api.allLoaded(_.values(this.state.liveUpdate))) {
        this.updateInProgress = false;
        utils.async(__ => {
          var emptyLiveUpdate = _.mapObject(this.getEndpoints(), (v, k) => null);
          this.setState(_.extend(
            {liveUpdate: emptyLiveUpdate},
            this.state.liveUpdate));
        });
      }
    }

    var queryParams = URI(window.location.href).search(true);
    var main = queryParams['main'];
    var aux = queryParams['aux'];
    var auxWidth = queryParams['auxWidth'];

    var endpoints = this.getEndpoints();
    var apiResponses = _.map(endpoints, (v, k) => this.state[k]);

    if (!api.allLoaded(apiResponses)) {
      return <APINotLoadedPage calls={apiResponses} widget={false} />; 
    }

    // Adding key=current timestamp forces us to unmount/remount
    // PusherPageContent every re-render. This seems to prevent crazy memory
    // leaks, albeit at the cost of slightly less responsiveness (which is fine
    // for a dashboard.) I think I could solve this in a more sophisticated
    // way, but this is fine for now.
    return <ChangesPage widget={false}>
      <PusherPageContent
        main={main}
        aux={aux}
        auxWidth={auxWidth}
        fetchedState={this.state}
        key={+Date.now()}
      />
    </ChangesPage>;
  },


  getEndpoints() {
    var queryParams = URI(window.location.href).search(true);

    var endpoints = {};

    var slugs = queryParams['main'];
    if (!_.isArray(slugs)) {
      slugs = [slugs];
    }
    if (queryParams['aux']) {
      slugs.push(queryParams['aux']);
    }

    _.each(slugs, slug => {
      var repo = slug, branch = null;
      if (slug.indexOf('::') > 0) {
        [repo, branch] = slug.split('::');
      }

      endpoints[slug] = URI(`/api/0/projects/${repo}/commits/`)
        .query({ all_builds: 1, branch: branch })
        .toString();
    });

    return endpoints;
  },

  liveUpdate() {
    // we'll make new API calls inside of liveUpdate. Once they've all
    // finished, we'll use setState to copy them over
    this.updateInProgress = true;
    this.setState({
      liveUpdate: _.mapObject(this.getEndpoints(), (v, k) => null)
    });

    api.fetchMap(this, 'liveUpdate', this.getEndpoints());
  },

  componentWillUnmount: function() {
    // clear the timer, if in use (e.g. the widget is expanded)
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
});

var PusherPageContent = React.createClass({
  
  propTypes: {
    main: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
    aux: PropTypes.string,
    auxWidth: PropTypes.number
  },

  getInitialState() { return {}; },

  render() {
    if (this.props.aux) {
      // aux is the ability to dedicate a column on the right to viewing a
      // different set of commits

      // technically this is generalizable to a series of different commit
      // lists, each with potentially many builds.. that's left as an exercise
      // to the reader.

      var auxWidth = this.props.auxWidth;
      if (!auxWidth || auxWidth < 0 || auxWidth > 100) {
        auxWidth = 40;
      }

      return <div style={{display: 'table'}}>
        <div style={{display: 'table-cell', width: (100-auxWidth) + '%'}}>
          {this.renderMain()}
        </div>
        <div style={{display: 'table-cell', width: auxWidth + '%'}}>
          {this.renderAux()}
        </div>
      </div>;
    } else {
      return this.renderMain();
    }
  },

  renderMain(main) {
    var mainProjects = this.props.main;
    if (!_.isArray(mainProjects)) {
      mainProjects = [mainProjects];
    }
    var totalProjectCount = mainProjects.length;

    // we want to map slugs to project data (e.g. so we know the name of the
    // project. This is buried within each buld
    var projectData = {};

    var commitLists = {};
    _.each(mainProjects, proj => {
      commitLists[proj] = this.props.fetchedState[proj].getReturnedData();
    });

    // I don't want to write anything too complicated, so here's what we'll do:
    // we'll use the first "main" project as the source of truth for revisions,
    // and augment it with displaying builds from other projects.
    var rows = _.map(commitLists[mainProjects[0]], baseCommit => {
      var everyCommit = {};
      _.each(commitLists, (commitList, proj) => {
        _.each(commitList, commitInList => {
          if (commitInList.sha === baseCommit.sha) {
            everyCommit[proj] = commitInList;
          }
        });
      });

      var initialCells = [];
      _.each(mainProjects, proj => {
        if (!everyCommit[proj]) {
          initialCells.push(null);
          return;
        }

        var commit = everyCommit[proj];
        var sortedBuilds = _.sortBy(commit.builds, b => b.dateCreated).reverse();
        var lastBuild = _.first(sortedBuilds);
        if (lastBuild) {
          if (lastBuild.project) {
            projectData[lastBuild.project.slug] = lastBuild.project;
          }
          var duration = null;
          if (get_runnable_condition(lastBuild) === 'waiting') {
            duration = <WaitingLiveText runnable={lastBuild} text={false} />;
          } else {
            var pieces = _.chain(display_duration_pieces(lastBuild.duration / 1000))
              .filter(p => p)
              .map(p => p.replace(/[dmsh]/, ''))
              .value();

            duration = pieces.join(":");
          }
            
          var colorCls = get_runnable_condition_color_cls(get_runnable_condition(lastBuild));
          var durationStyle = {
            display: 'inline-block',
            position: 'relative',
            top: -2,
          };

          initialCells.push(
            <div>
              <div className="inlineBlock">
                <SingleBuildStatus
                  build={lastBuild}
                  parentElem={this}
                />
              </div>
              <a 
                href={ChangesLinks.buildHref(lastBuild)}
                className={colorCls} 
                style={durationStyle}>
                {duration}
              </a>
            </div>
          );
        } else {
          initialCells.push(null);
        }
      });

      // TODO: add the skip the queue indicator to this page (for consistency,
      // if nothing else)
      var title = utils.truncate(utils.first_line(baseCommit.message));

      return initialCells.concat([
        title,
        ChangesLinks.author(baseCommit.author),
        ChangesLinks.phabCommit(baseCommit),
        <span><TimeText time={baseCommit.dateCommitted} /></span>
      ]);
    });

    var projectHeaders = _.map(mainProjects, proj => {
      var [repo, branch] = proj.split('::');
      var name = utils.truncate(
        (projectData[repo] && projectData[repo].name) || repo, 
        20);
      return branch ? `${name} (${branch})` : name;
    });

    var headers = projectHeaders.concat([
      'Name',
      'Author',
      'Commit',
      'Committed'
    ]);

    var classHeaders = _.map(mainProjects, proj => 'nowrap buildWidgetCell');
    var cellClasses = classHeaders.concat([
      'wide',
      'nowrap',
      'nowrap',
      'nowrap'
    ]);

    // trivia: the title here exists solely so that its at the same height as the aux chart.
    var title = this.props.aux ?
      <div style={{textAlign: 'center', marginBottom: 10}}>
        Commits to {projectHeaders[0]}. Live Updates{" "}
        <span className="bluishGray">(every {POLL_INTERVAL / 1000} seconds)</span>
      </div> :
      null;

    return <div>
      {title}
      <Grid
        colnum={4 + totalProjectCount}
        cellClasses={cellClasses}
        headers={headers}
        data={rows}
      />
    </div>;
  },
  
  renderAux() {
    var auxProject = this.props.aux;
    var [repo, branch] = auxProject.split('::');

    var commitList = this.props.fetchedState[auxProject].getReturnedData();

    var project = null; 
    var rows = _.map(commitList, commit => {
      var sortedBuilds = _.sortBy(commit.builds, b => b.dateCreated).reverse();
      var lastBuild = _.first(sortedBuilds);

      var buildMarkup = null;
      if (lastBuild) {
        if (lastBuild.project) {
          project = lastBuild.project;
        }
        buildMarkup = <SingleBuildStatus
          build={lastBuild}
          parentElem={this}
        />;
      }

      return [
        buildMarkup,
        utils.truncate(utils.first_line(commit.message)),
        <span><TimeText time={commit.dateCommitted} /></span>
      ];
    });

    var headers = ['Build', 'Name', 'Committed'];
    var cellClasses = ['nowrap', 'wide', 'nowrap'];

    var title = project ? project.name : repo;

    return <div style={{paddingLeft: 30, marginLeft: 30, borderLeft: '1px solid #e5e5e5'}}>
      <div style={{textAlign: 'center', marginBottom: 10}}>{title}</div>
      <Grid
        colnum={3}
        cellClasses={cellClasses} 
        headers={headers} 
        data={rows}
      />
    </div>;
  },
});

export default PusherPage;
