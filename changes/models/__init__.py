from changes.utils.imports import import_submodules

import_submodules(globals(), __name__, __path__)

# Below is generated using roughly:
# from ~/changes$ git grep ^class changes/models/*.py | sed 's|.py:class | import |; s|changes/models/|from |; s|(db.Model):||'
from adminmessage import AdminMessage
from artifact import Artifact
from author import Author
from build import BuildPriority
from build import Build
from buildseen import BuildSeen
from cached_snapshot_image import CachedSnapshotImage
from change import Change
from command import CommandType
from command import FutureCommand
from command import Command
from comment import Comment
from event import EventType
from event import Event
from failurereason import FailureReason
from filecoverage import FileCoverage
from flakyteststat import FlakyTestStat
from itemsequence import ItemSequence
from itemstat import ItemStat
from job import Job
from jobphase import JobPhase
from jobplan import HistoricalImmutableStep
from jobplan import JobPlan
from jobstep import FutureJobStep
from jobstep import JobStep
from latest_green_build import LatestGreenBuild
from log import LogSource
from log import LogChunk
from node import Cluster
from node import ClusterNode
from node import Node
from option import ItemOption
from patch import Patch
from phabricatordiff import PhabricatorDiff
from plan import PlanStatus
from plan import Plan
from project import ProjectConfigError
from project import Project
from project import ProjectOption
from project import ProjectOptionsHelper
from repository import RepositoryBackend
from repository import RepositoryStatus
from repository import Repository
from revision import Revision
from snapshot import SnapshotStatus
from snapshot import Snapshot
from snapshot import SnapshotImage
from source import Source
from step import Step
from task import Task
from test import TestCase
from testartifact import TestArtifactType
from testartifact import TestArtifact
from testresult import TestResult
from testresult import TestResultManager
from user import User

# Hand to add by hand
from step import STEP_OPTIONS
from log import LOG_CHUNK_SIZE
from changes.constants import ProjectStatus, Status, Result
