/**
 * Every Japanese dictionary shipped by this pack, keyed by the namespace it
 * registers. Sorted by namespace so review and diffs stay stable.
 */
import { ja as agentTeam } from './agent-team.ts'
import { ja as approval } from './approval.ts'
import { ja as chat } from './chat.ts'
import { ja as command } from './command.ts'
import { ja as common } from './common.ts'
import { ja as conversation } from './conversation.ts'
import { ja as cordis } from './cordis.ts'
import { ja as deliverables } from './deliverables.ts'
import { ja as directoryBrowser } from './directory-browser.ts'
import { ja as documenthtml } from './document-html.ts'
import { ja as documentmarkdown } from './document-markdown.ts'
import { ja as feedback } from './feedback.ts'
import { ja as gitBranch } from './git-branch.ts'
import { ja as goal } from './goal.ts'
import { ja as job } from './job.ts'
import { ja as model } from './model.ts'
import { ja as openInApp } from './open-in-app.ts'
import { ja as permissionAccess } from './permission-access.ts'
import { ja as plan } from './plan.ts'
import { ja as pluginManager } from './plugin-manager.ts'
import { ja as question } from './question.ts'
import { ja as reference } from './reference.ts'
import { ja as scheduleCatalog } from './schedule-catalog.ts'
import { ja as sessionLogDownload } from './session-log-download.ts'
import { ja as settings } from './settings.ts'
import { ja as settingsAccount } from './settings-account.ts'
import { ja as settingsAgentLoop } from './settings-agent-loop.ts'
import { ja as settingsAgentPreset } from './settings-agent-preset.ts'
import { ja as settingsFont } from './settings-font.ts'
import { ja as settingsLocale } from './settings-locale.ts'
import { ja as settingsModels } from './settings-models.ts'
import { ja as settingsPermission } from './settings-permission.ts'
import { ja as settingsPluginInventory } from './settings-plugin-inventory.ts'
import { ja as settingsPlugins } from './settings-plugins.ts'
import { ja as settingsShell } from './settings-shell.ts'
import { ja as settingsSubagent } from './settings-subagent.ts'
import { ja as settingsTheme } from './settings-theme.ts'
import { ja as settingsWebSearch } from './settings-web-search.ts'
import { ja as shortcuts } from './shortcuts.ts'
import { ja as shortcutsLayout } from './shortcuts-layout.ts'
import { ja as sidebar } from './sidebar.ts'
import { ja as sidebarBrowser } from './sidebar-browser.ts'
import { ja as sidebarcodepreview } from './sidebar-code-preview.ts'
import { ja as sidebardocumentpreview } from './sidebar-document-preview.ts'
import { ja as sidebarExcel } from './sidebar-excel.ts'
import { ja as sidebarfiles } from './sidebar-files.ts'
import { ja as sidebarimage } from './sidebar-image.ts'
import { ja as sidebarOffice } from './sidebar-office.ts'
import { ja as sidebarpdf } from './sidebar-pdf.ts'
import { ja as sidebarright } from './sidebar-right.ts'
import { ja as sidebarTerminal } from './sidebar-terminal.ts'
import { ja as skill } from './skill.ts'
import { ja as slashMenu } from './slash-menu.ts'
import { ja as subagent } from './subagent.ts'
import { ja as trajectory } from './trajectory.ts'
import { ja as workflowrun } from './workflow-run.ts'
import { ja as workspace } from './workspace.ts'

/** Namespace to Japanese dictionary, registered in this order. */
export const DICTIONARIES: readonly { ns: string; dict: Record<string, string> }[] = [
  { ns: 'agent-team', dict: agentTeam },
  { ns: 'approval', dict: approval },
  { ns: 'chat', dict: chat },
  { ns: 'command', dict: command },
  { ns: 'common', dict: common },
  { ns: 'conversation', dict: conversation },
  { ns: 'cordis', dict: cordis },
  { ns: 'deliverables', dict: deliverables },
  { ns: 'directory-browser', dict: directoryBrowser },
  { ns: 'documentHtml', dict: documenthtml },
  { ns: 'documentMarkdown', dict: documentmarkdown },
  { ns: 'feedback', dict: feedback },
  { ns: 'gitBranch', dict: gitBranch },
  { ns: 'goal', dict: goal },
  { ns: 'job', dict: job },
  { ns: 'model', dict: model },
  { ns: 'open-in-app', dict: openInApp },
  { ns: 'permission.access', dict: permissionAccess },
  { ns: 'plan', dict: plan },
  { ns: 'pluginManager', dict: pluginManager },
  { ns: 'question', dict: question },
  { ns: 'reference', dict: reference },
  { ns: 'schedule.catalog', dict: scheduleCatalog },
  { ns: 'session-log-download', dict: sessionLogDownload },
  { ns: 'settings', dict: settings },
  { ns: 'settings.account', dict: settingsAccount },
  { ns: 'settings.agentLoop', dict: settingsAgentLoop },
  { ns: 'settings.agentPreset', dict: settingsAgentPreset },
  { ns: 'settings.font', dict: settingsFont },
  { ns: 'settings.locale', dict: settingsLocale },
  { ns: 'settings.models', dict: settingsModels },
  { ns: 'settings.permission', dict: settingsPermission },
  { ns: 'settings.pluginInventory', dict: settingsPluginInventory },
  { ns: 'settings.plugins', dict: settingsPlugins },
  { ns: 'settings.shell', dict: settingsShell },
  { ns: 'settings.subagent', dict: settingsSubagent },
  { ns: 'settings.theme', dict: settingsTheme },
  { ns: 'settings.webSearch', dict: settingsWebSearch },
  { ns: 'shortcuts', dict: shortcuts },
  { ns: 'shortcuts.layout', dict: shortcutsLayout },
  { ns: 'sidebar', dict: sidebar },
  { ns: 'sidebarBrowser', dict: sidebarBrowser },
  { ns: 'sidebarCodePreview', dict: sidebarcodepreview },
  { ns: 'sidebarDocumentPreview', dict: sidebardocumentpreview },
  { ns: 'sidebarExcel', dict: sidebarExcel },
  { ns: 'sidebarFiles', dict: sidebarfiles },
  { ns: 'sidebarImage', dict: sidebarimage },
  { ns: 'sidebarOffice', dict: sidebarOffice },
  { ns: 'sidebarPdf', dict: sidebarpdf },
  { ns: 'sidebarRight', dict: sidebarright },
  { ns: 'sidebarTerminal', dict: sidebarTerminal },
  { ns: 'skill', dict: skill },
  { ns: 'slash.menu', dict: slashMenu },
  { ns: 'subagent', dict: subagent },
  { ns: 'trajectory', dict: trajectory },
  { ns: 'workflowRun', dict: workflowrun },
  { ns: 'workspace', dict: workspace },
]
