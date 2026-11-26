English | [Español](README.es.md)

# Wayfinder

A personal Markdown task tracker that Claude Code uses as your "personal Jira" and as the memory of each project.

- Claude checks what is pending, proposes ideas, moves statuses and records every piece of progress in the task's history; the day's log links to that progress.
- You mostly watch, create tasks, and approve or discard ideas, from the local web board or by asking Claude in the chat.

The data lives in a private folder (`~/.wayfinder`): a git repository **with no remote** and one commit per write. Wayfinder stores nothing in the `.claude/`, `AGENTS.md` or `CLAUDE.md` of your projects.

## Requirements

- Windows 11 (the only verified platform).
- Node.js 22 or later, and git.
- Claude Code 2.1.271 or later, for the plugin. The one-command install was tested with Claude Code 2.1.318; installing, updating and uninstalling as described below, with Claude Code 2.1.332.

## Installing the Claude Code plugin

From GitHub, with one command:

```powershell
claude plugin install wayfinder --marketplace davidgarciai554/wayfinder --config language=en
```

It adds the Wayfinder marketplace if you do not have it yet and installs the plugin. From a local copy of this repository, replace `davidgarciai554/wayfinder` with its path, for example `--marketplace D:\path\to\wayfinder`.

If your version of Claude Code does not accept `--marketplace`, use two steps:

```powershell
claude plugin marketplace add davidgarciai554/wayfinder
claude plugin install wayfinder@wayfinder --config language=en
```

When it finishes, Claude Code may warn that some options are not set: they are `home`, `capturesDir` and `webHost`, which are optional and can stay as they are.

- `language`: `es` or `en`. Language of the messages, of the web board and of Claude's answers about Wayfinder.
- `home` (optional): the data folder. Default: `~/.wayfinder`.
- `capturesDir` (optional): an extra folder from which screenshots can be attached, besides the current repository.
- `webHost` (optional): this PC's IP on your network or on Tailscale (an IP such as `192.168.1.20`; not a name and not `0.0.0.0`), to open the web board on other devices too. Empty or not valid: the web board only opens on this PC.

You can change them later with `/plugin` or with `claude plugin configure wayfinder@wayfinder`.

### First use

1. In the repository you want to track, write in the chat yourself: "register this project" (or «registra este proyecto»).
   - It has to be that phrase, written by you: a "yes" is not enough. That way Claude cannot register a repository on its own.
   - The order is valid for 15 minutes and for a single registration.
   - If the data folder (`~/.wayfinder`) does not exist yet, it is created at that moment. `wayfinder init` is no longer needed, although it is still available.
2. If you do not want to track a repository, tell Claude: it takes note and Wayfinder stops asking in it. You can register it later with the same phrase.
3. From then on, each session starts with the list of pending tasks and the proposals that are not approved yet.
   - Claude moves the statuses while it works.
   - Each piece of progress goes into the task's history and into a log line that links to it (see "[History and memory](#history-and-memory)").
   - Before finishing, if there are tasks in progress and no progress has been recorded today, Claude records it.
   - Non-trivial tasks need a plan in `Planes/` before they move to "In progress".

## Updating the plugin

Each step says whether it was checked with Wayfinder or whether only the Claude Code documentation says so. The checked steps were tested with Claude Code 2.1.322 and the plugin installed from a local copy of the repository, unless another version is named.

1. **See what you have installed.** `claude plugin list --json` shows, for `wayfinder@wayfinder`:
   - `version`: the version Claude Code has recorded.
   - Where it is loaded from: if `readFromFolder` appears, from that folder of yours; if not, from the cached copy in `installPath`.
   - `folderVersion`: the version that folder declares. If it differs from `version`, there is an update to record.

   `node "<that folder>\dist\wayfinder.mjs" --version` prints the program's version. *Checked.*
2. **If you installed it from a local copy of the repository, update that copy first** (`git pull`). Claude Code loads the plugin straight from the folder: the new code takes effect in the next session even if the version number did not change. *Checked.*
3. **Update the plugin:**

   ```powershell
   claude plugin marketplace update wayfinder
   claude plugin update wayfinder@wayfinder
   ```

   - **From a local copy.** *Checked, in that order.* Without a version change it answers "nothing to update" and "already at the latest version". With a version change, for example "updated from 0.1.0 to 1.0.0", and `version` becomes the new one (*checked from 0.1.0 to 1.0.0 with Claude Code 2.1.332*).
   - **From GitHub** (one cached copy per version). Without a version change it answers "already at the latest version (0.1.0)" (*checked with Claude Code 2.1.332*). What follows comes from the Claude Code documentation and has not been checked with Wayfinder from GitHub yet (the jump from 0.1.0 to 1.0.0 was checked from a local copy): Claude Code only fetches a new copy when the plugin's version number changes. "already at the latest version" means you have the latest numbered version, not necessarily the latest changes in the repository: while the number does not change, a copy installed from GitHub does not change.
4. **Restart the open Claude sessions.** A running session keeps the previous server and does not show the new features. `claude plugin update` says so: "Restart to apply changes" (*checked*). Claude Code says `/reload-plugins` also applies it without closing the session (*not checked*).

What is kept:

- **Your data.** The data folder (`~/.wayfinder`, or the one you set in `home`) is outside the plugin and its cache. *Checked: `claude plugin update` wrote nothing in the folder set in `home`.*
- **Your options** (`language`, `home`, `capturesDir`, `webHost`). Claude Code keeps them in its settings, outside the plugin. *Checked: `claude plugin update` kept `language` and `home`.* Uninstalling does delete them (see "[Uninstalling](#uninstalling)"), and updating does not require uninstalling.

If the read-only warning appears after updating, see "[Data format and updates](#data-format-and-updates)". What changes between versions is in [CHANGELOG.md](CHANGELOG.md) (in Spanish). Without the plugin, or with Docker, repeat the installation from their sections ("[Command line without the plugin](#command-line-without-the-plugin)", "[Docker](#docker)").

## Uninstalling

Checked with Claude Code 2.1.332 and the plugin installed from GitHub.

1. Close the open Claude Code sessions. A running session keeps using the plugin, and the web board it opened, until it ends.
2. Uninstall the plugin and remove the marketplace:

   ```powershell
   claude plugin uninstall wayfinder@wayfinder
   claude plugin marketplace remove wayfinder
   ```

   Afterwards, `claude plugin list` no longer shows `wayfinder@wayfinder`.

What is deleted and what stays:

- **Deleted:** the plugin, the marketplace and **your options** (`language`, `home`, `capturesDir`, `webHost`). If you install it again, set them again with `--config` or with `claude plugin configure wayfinder@wayfinder`.
- **Your data folder stays** (`~/.wayfinder`, or the one you set in `home`), with your tasks, logs, errors and screenshots. Uninstalling does not touch it: if you install Wayfinder again with the same folder, everything is there.
- The cached copy of the plugin stays in `~/.claude\plugins\cache\wayfinder`, marked as orphaned (`.orphaned_at`). Nothing uses it; you can delete that folder.
- If you created the firewall rule from "[Web board](#web-board)", it is still there. To remove it, in PowerShell as administrator: `Remove-NetFirewallRule -DisplayName "Wayfinder (Node) - red privada"`. *Not checked: it needs administrator rights.*
- To delete your data too, make a backup first (see "[Backup and restore](#backup-and-restore)") and delete the folder. This cannot be undone:

  ```powershell
  Remove-Item -Recurse -Force "$env:USERPROFILE\.wayfinder"
  ```

Without the plugin, or with Docker, see how to remove them in their sections: "[Command line without the plugin](#command-line-without-the-plugin)" and "[Docker](#docker)".

## Backup and restore

The data folder (`~/.wayfinder`, or the one you set in `home`) is a git repository with no remote. Wayfinder never uploads it anywhere, so backing it up is up to you. It holds:

- `projects\`: your tasks, logs, errors and screenshots.
- `config.json` and `FORMAT`: the settings and the data format version.
- `.state\`: short-lived data that is not in git, such as the chat orders of the last 15 minutes and the repositories you said no to.

Before copying or restoring, close the Claude Code sessions (and with them the web board) and `wayfinder serve`, so you do not copy in the middle of a write.

Copy the whole folder, `.git` included (the backup's parent folder, here `D:\backups`, must exist):

```powershell
Copy-Item -Recurse -Force "$env:USERPROFILE\.wayfinder" "D:\backups\wayfinder-2026-11-26"
```

To restore it, the destination folder must not exist. If it does, move it aside first:

```powershell
Rename-Item "$env:USERPROFILE\.wayfinder" ".wayfinder-previous"
Copy-Item -Recurse -Force "D:\backups\wayfinder-2026-11-26" "$env:USERPROFILE\.wayfinder"
```

To check the restore, `git -C "$env:USERPROFILE\.wayfinder" log --oneline -3` shows the same latest commits as the backup, and the web board shows your projects and tasks.

Do not restore with `git clone` or `git bundle`: the result loses `.state\`, and on Windows git writes the files back with CRLF line endings, so Wayfinder flags every task as "modified outside Wayfinder".

## Everyday use

### History and memory

Each task has a `## Historial` section at the end of its file (the heading is the same in both languages). It starts with a creation entry and grows with each piece of progress Claude records with `wf_log` and the task ID:

- **In the task:** date and time, what was done, decisions, files, next step and blockers.
- **In the day's log:** a line "WAY-3 · title — We advanced on…" that links to that entry. Minor work without a task (for example, reviewing the repository) goes only to the log.
- **On the web board:** from the log you reach the exact history entry, and from each entry the log day on which it was written.
- **For Claude:** at the start of the session it receives the latest progress of up to two tasks in progress. On demand, `wf_history` gives the index of a task's history, a full entry or the timeline of the last days, and `wf_search` searches literal text in errors, tasks, histories and the log.

History rules:

- Only Wayfinder writes in it. Editing the task description never touches it, and a description cannot contain the line `## Historial`.
- It has its own limit of 100,000 characters per task. It warns past 80 % and, at the limit, rejects the entry with a clear message.
- What Claude reads from the history is treated as untrusted data, like descriptions.
- Tasks created with a 0.1.0 copy older than the history are not migrated: they show an empty history until their first progress entry.

### Error records

When something fails (build, tests, analysis, runtime or unexpected behaviour), Claude records it with `wf_error`, linked to the task it is working on. It is Wayfinder's equivalent of the `ERRORES.md` that the base instructions ask for.

- **One file per error:** `projects/<slug>/errors/ERR-n-<title>.md`, with context, reproduction, observed output, cause (hypothesis or confirmed), solution, validation, result and files. Status open, resolved or discarded.
- **Kind (optional):** `build`, `test`, `analysis` (lint, types), `runtime`, `behavior` (unexpected behaviour) or `environment` (ports, permissions, configuration, dependencies). It can be set when creating the error or later with `update`. Errors without a kind, including those recorded with a 0.1.0 copy older than kinds, show as "Unclassified". The `ERR` prefix is reserved: no new project can use it.
- **Actions:** `create` (needs the task, which must exist, and the context), `update` (kind, cause, solution, validation, result and files; also reopening with a note), `note` (a recurrence or a correction), `resolve` (requires solution and validation) and `discard` (closes without a solution a false alarm or a failure that will not be fixed; requires a note with the reason, and Claude tells you). A resolved or discarded error is reopened with `update`, `reopen` and a note. Context, reproduction, output and title cannot change: they are corrected with a note.
- **Changing the task:** an error recorded on the wrong task moves to another task of the project with `update`, `task_id` and a required note with the reason, in any status. The error's history keeps where it was recorded and adds "Task: WAY-3 -> WAY-5." with the note. Each error stays linked to a single task.
- **Before investigating:** `wf_search` shows up to 5 errors first, and when creating one Claude sees the possible open duplicates. If it is the same failure, it adds a note instead of creating another one.
- **Automatic reminder:** when a build, test or analysis command ends with an error (for example `npm test`, `npm run build`, `tsc`, `pytest`, `cargo test` or `dotnet build`, also inside `cd x && …`), a plugin hook (`PostToolUseFailure`) reminds Claude to look for the failure with `wf_search` and to record it with `wf_error` if it is new and unexpected. It only reminds: it creates nothing, does not block, does not repeat the command or its output, and only acts in registered projects. It reminds on every failure, expected ones too (a test written before the code), and the text tells Claude to ignore it then.
- **For Claude:** `wf_get ERR-n` gives the full error and `wf_get` of a task lists its errors. At the start of the session it receives up to 5 open errors (only ID, task, kind and title) and a count per kind, if they fit.
- **Listing errors:** `wf_errors` (read only) lists the project's errors, most recently updated first and at most 50, with ID, status, kind, task and title. By default only open ones. It filters by status (`status`: `open`, `resolved`, `discarded`), kind (`kind`: the six kinds or `unclassified`) and task (`task_id`, which must exist); filters combine. An error with a status your version of Wayfinder does not know is left out when filtering: you see it with `wf_get`, `wf_search` and the web board.
- **On the web board:** an "Errors" tab with open, resolved and discarded errors (with the reason in their notes), each group split into sections per kind with their count; one page per error and an "Errors (n)" section in each task. Read only.
- **Earlier versions:** a 0.1.0 copy older than discarded errors, on the same data folder, shows those errors as "unreadable" (without deleting or changing them) until you update it. From 1.0.0 on, a status Wayfinder does not know is shown as it is and cannot be changed.
- **Secrets:** a field that looks like it contains a secret is rejected and nothing is saved. The detector is heuristic and does not recognise personal data (for example, user folders or e-mail addresses): summarise the output instead of pasting it whole.
- Error text is treated as untrusted data, like task text.

### Listing tasks

`wf_list` lists up to 200 tasks; by default, those to do, in progress and proposed. It filters by status (`status`), priority (`priority`: `low`, `medium`, `high`), tag (`tag`: tasks with any of the requested tags) and title text (`query`: literal, case-insensitive); filters combine. If there are more matches, it ends with "… and N more tasks".

### Tags

A task can have up to 10 free tags to group it by area (`web`, `mcp`, `hooks`, `docs`…). Claude sets them with `wf_create` or `wf_update` and `tags`; the list is replaced whole and `[]` empties it.

- Format: lowercase letters, digits and hyphens, up to 30 characters and no spaces. A tag outside that format is rejected with a clear message; it is not converted.
- They show in `wf_get` (`tags:`), in `wf_list` (`#web` after the title) and on the web board, on the card and in the detail header.
- On the board, the "Tag" selector shows only the tasks with that tag and says so in a notice with a "Clear filter" button. The choice is remembered in that browser for each project.
- They are not set or removed from the web board. A tag written by hand in another format is ignored when reading, and is kept in the file as long as nobody changes that task's tags.

### Dependencies between tasks

A task can depend on others of the same project ("WAY-7 depends on WAY-2"). Claude writes them with `wf_update` and `depends_on`; the list is replaced whole and `[]` empties it.

- It rejects, saving nothing, a task that does not exist in the project, the task itself, a repeated ID, more than 20 dependencies or a cycle.
- Only a done task releases the ones that depend on it. A discarded dependency keeps blocking until someone removes it; one that does not exist does not block.
- It is planning information: it never prevents a status change. When starting a task with unfinished dependencies, Claude receives a warning.
- They show in `wf_get`, in `wf_list` ("blocked by WAY-n") and on the web board: the "Blocked by WAY-n" label on the card and the "Depends on" row in the detail. They are not edited from the web board.

### Blocking a task

When a task cannot move forward because of something that is not another task (it waits for a decision of yours, a credential or an external service), Claude marks it as blocked with its reason: `wf_log` with `blocked: true` and the reason in `blockers`. If what it waits for is another task, a dependency is used.

- Only tasks "to do" or "in progress" are blocked. The reason is one line of up to 200 characters; the detail goes into the history entry, saved in the same step.
- It is not a status: the task stays where it was. The block is information and never prevents a status change.
- It is unblocked with `wf_log` and `blocked: false`; the entry is the note that says what unblocked it. Moving the task to done or discarded, or reopening it, also removes the block.
- `blockers` without `blocked` is still free text of that entry: it neither blocks the task nor changes the reason.
- It shows in `wf_list` ("blocked: reason"), in `wf_get` and on the web board, with the "Blocked" label and the reason on the card and in the detail. In the task list Claude receives at the start of the session only the `[blocked]` mark appears; it reads the reason when it needs it.
- The web board does not block or unblock: tell Claude.
- **Earlier versions:** the block is saved as an optional key (`blocked`) in the task file. An earlier plugin on the same data folder reads the task normally and keeps the key, but does not show the block.

### Asking for several tasks at once

If you ask for a single task, Claude does it in the same chat. If you ask for several by ID ("do WAY-3, WAY-5 and WAY-7"):

- Claude gathers the tasks you name and the open dependencies that block them, nothing more. If one of those dependencies is a proposal, it stops and asks you to approve it.
- Before starting it tells you the split. Independent tasks go each to its own session, in its own worktree if they touch code. Tasks that depend on each other go in a single session, the releasing one first.
- In Claude Code Desktop it opens those sessions. In the terminal it cannot, so it tells you and does them all in the same chat, in that order.
- The loop approves nothing. Each non-trivial task still needs its approved plan. If the plan is missing or something fails, it stops and tells you what it needs.

### Reopening a task

A done or discarded task is reopened only from the web board, with the "Reopen" button and a required reason, which stays in the task's history and in the log.

- It goes back to "To do" if it is yours or if it was approved. A Claude proposal that nobody approved goes back to "Proposals" and has to be approved again (via chat, with a new review).
- Claude cannot reopen tasks: if needed, it asks you to do it on the web board.

### Approving ideas from the chat

Write the order with the ID, for example "approve WAY-4". For several at once, one verb and the list: "approve WAY-4, WAY-5 and WAY-6". The Spanish forms work too: «aprueba WAY-4», «apruebo las tres tareas WAY-4, WAY-5 y WAY-6».

- Between "approve" («aprueba», «apruebo») and the first ID there can be up to 3 words. With "do" or "start" («haz», «empieza»), up to 2, so that a work request like "do a summary of WAY-4" does not count as an order. IDs are separated with commas, "and", «y» or «e».
- The list ends at anything else: "approve WAY-4 but not WAY-5" only approves WAY-4. Ranges ("WAY-4 to WAY-6") and IDs separated only by spaces are not accepted.
- With more than 10 IDs in one message, none counts.
- Without an ID, a message that only says "approve" (or «apruebo», «Sí, apruébala») is enough right after Claude presents a proposal to you: it applies to the only proposal it reviewed in the last 15 minutes. If it reviewed more than one, or none, nothing is approved and Claude asks you for the ID. "approve the plan" or "approve, but change the title" do not approve any task.
- A negation before the list, a question, a quote (`>`) or a code block cancel the order. Each proposal goes through its own review.

1. Claude reviews the proposal before approving it.
2. If it sees something suspicious (hidden instructions, requests for secrets, network commands…), it explains the reason and does not approve it until you repeat the order, for example "approve WAY-4 anyway".
3. Only proposals created by Claude are approved via chat, and they are marked "Approved via chat".

## Web board

Write in the chat **"open Wayfinder"** (or «abre Wayfinder»). As with registering, it has to be that phrase, written by you: a "yes" is not enough.

- Claude opens the web board for that session and gives you an address on this PC, for example `http://127.0.0.1:4747/`. Open it in the PC's browser.
- If the web board also opens on the network (`webHost` option), Claude also gives you the link for your phone, which opens with one tap. If you use Claude from your phone (Remote Control), tap it right there.
- On that page:
  - **"Enable writing on this PC"** enables creating, approving, discarding and reopening in that browser.
  - **"Open on another device"** shows the link for your phone or another computer, with a button to copy it.
- To use it on other devices, set the plugin's `webHost` option to this PC's IP on your network or on Tailscale. Without `webHost`, the web board only opens on this PC.
- Outside this PC, everything asks for the link's key, reading too.
- Each time the web board opens there is a new key, and the previous one stops working. An old link shows "This link is no longer valid".
- When you open the link, the key is stored in a cookie of that browser and disappears from the address. So that browser can come back without the link while the session lasts. Other browsers and devices still need the link, and the cookie stops working when the key changes.
- The web board closes when the Claude session ends.
- Traffic is not encrypted: use it on your home network or with Tailscale.
- **The first time you open Wayfinder on the network, accept the firewall prompt on the PC.** If you do not accept it, your phone cannot connect. Wayfinder does not change firewall rules.
  - Windows asks whether to allow Node.js to access the network: tick only **private networks** and press "Allow". Your home network has to be marked as private.
  - On a Mac the firewall is off by default. If you turned it on, macOS asks whether to allow incoming connections to `node`: press "Allow".
  - If you closed the prompt without accepting it, on Windows you can create the rule by hand from "Windows Defender Firewall" › "Allow an app through firewall" › "Change settings". Both ways need administrator rights. If you use the command, open PowerShell with "Run as administrator"; otherwise Windows answers "Access denied". On a company computer, only IT may be able to do it.

    ```powershell
    New-NetFirewallRule -DisplayName "Wayfinder (Node) - red privada" -Direction Inbound -Action Allow -Protocol TCP -Program "C:\Program Files\nodejs\node.exe" -LocalPort 4747 -Profile Private
    ```
- Limits:
  - The web board only exists while the Claude session that opened it lasts. With Claude closed, your phone cannot connect, and an old link cannot show the expired notice.
  - If your router gives the PC another IP (DHCP), update `webHost`. With Tailscale, the Tailscale network IP does not change.
  - If another Claude session already uses port 4747, the web board opens on another free port, with its own key. The firewall rule above only opens 4747, so in that case your phone cannot connect; Claude warns you when it gives you the link. Close the other session's web board (or that session) and write "open Wayfinder" again.

For development or Docker, `wayfinder serve` still exists:

```powershell
node "<plugin folder>\dist\wayfinder.mjs" serve
```

- It prints a link with a key, `http://127.0.0.1:4747/?k=…`, which also changes on every start. Without the key, on this computer the web board is read only.
- Options:
  - `--port <n>` (or `WAYFINDER_PORT`): the port. If another application uses it, `serve` says so and does not start.
  - `--poll`: detects changes by polling, for network drives.

## MCP tools

The plugin gives Claude these 14 tools. You do not use them: you ask Claude in the chat. What they read from tasks, errors, histories and the log is treated as untrusted data.

| Tool | What it does |
| --- | --- |
| `wf_project` | `get`: the project of the current repository and the language to answer in. `register`: registers the repository, only after you write "register this project". `decline`: notes that you do not want to track that repository. |
| `wf_web` | `start`, `status` and `stop` of the session's web board (see "[Web board](#web-board)"). `start` only works after you write "open Wayfinder". |
| `wf_list` | Lists tasks, with filters (see "[Listing tasks](#listing-tasks)"). |
| `wf_get` | Reads a task, with the list of its errors, or an `ERR-n` error. |
| `wf_create` | Creates a task, always as a proposal you have to approve. |
| `wf_review` | Reviews a proposal before approving it and returns its risk signals. Claude gives you its verdict. |
| `wf_set_status` | Changes the status. From proposal to "To do", only with your order in your latest message and after `wf_review` (see "[Approving ideas from the chat](#approving-ideas-from-the-chat)"). To "In progress", with a plan in `Planes/` or marked as trivial with a note. |
| `wf_update` | Changes the title, priority, plan, description, dependencies (`depends_on`) or tags (`tags`). Never the status or the history. |
| `wf_log` | Records progress in the task's history and in the day's log. It also blocks and unblocks (see "[Blocking a task](#blocking-a-task)"). |
| `wf_history` | The index of a task's history, a full entry or the timeline of the last days (7 by default). |
| `wf_search` | Searches literal text in errors, tasks, histories and the log. |
| `wf_error` | Creates, updates, annotates, resolves or discards an error (see "[Error records](#error-records)"). |
| `wf_errors` | Lists the project's errors, with filters. Read only. |
| `wf_attach` | Attaches a screenshot (png, jpg, webp or gif, up to 10 MB) from the current repository or from `capturesDir`, with a required description. |

## Command line without the plugin

The package is published on npm as `@chinorris/wayfinder`:

```powershell
npm install -g @chinorris/wayfinder
wayfinder init
wayfinder serve
```

- **Update:** `npm install -g @chinorris/wayfinder@latest`.
- **From a copy of the repository** (for example, to try changes that are not published): `git clone https://github.com/davidgarciai554/wayfinder.git`, then `npm ci`, `npm pack` and `npm install -g .\chinorris-wayfinder-<version>.tgz` in that folder. `npm install -g github:davidgarciai554/wayfinder` does not work: with npm 11.17 it fails while building the package ("Cannot find package 'esbuild'").
- **Uninstall:** `npm uninstall -g @chinorris/wayfinder`. The data folder is not touched.

The package contains a single `dist/wayfinder.mjs` file with no dependencies, the web board and `THIRD_PARTY_NOTICES.md` with the licences of the libraries bundled in it.

## Data format and updates

The data folder has at its root a `FORMAT` file with a single integer: the version of the data format (today, `1`). The folder writes it when it is created. A folder created before it existed does not have it and counts as format 1; Wayfinder does not add it on its own, because opening the folder never writes anything.

- **Data newer than the plugin.** If `FORMAT` holds a higher number than your version understands (for example, a Claude session that keeps the plugin it started with, or an old Docker image on the same folder):
  - Claude receives a warning at the start of the session and at the end of every answer of the `wf_*` tools; the web board shows it under the top bar.
  - The folder becomes **read only**: everything can be read, but nothing is saved (tasks, progress, errors, screenshots, or the "register this project" and "open Wayfinder" orders). The web board hides its buttons even if you have the key.
  - To get out: restart the Claude session or update Wayfinder (see "[Updating the plugin](#updating-the-plugin)"); with Docker, rebuild the image. If the mark were wrong, restore it from the git history of the data folder or delete `FORMAT` (back to format 1). There is no option to skip the block.
  - The mark is read on every operation, so a process that was already running notices without restarting. The web board shows it on the next refresh or navigation (at most about 30 seconds).
- **A mark that cannot be understood** (empty, text, an invalid number): it warns, treats it as format 1 and keeps working.
- **New statuses.** A task with a status your version does not know is shown with that status as it is (on the web board, in the "Other statuses" section) and cannot be changed; tasks that depend on it stay blocked. Errors already worked this way.
- **What 1.x can change without raising the mark:** new optional keys or fields, new status values (of tasks or errors) and new entry types. A version that does not understand them keeps them, shows them and does not overwrite them.
- **What forces raising the mark (and a 2.0):** renaming or removing a field, changing its meaning, moving the folder structure, or adding values to the priority or origin of tasks (an earlier version would read them as `medium` or `user` and lose them when rewriting the task). The mark is always a single decimal integer. `test/format.test.ts` pins the version and those values, but does not detect renames or changes of meaning: the rule has to be applied when reviewing.
- **Earlier versions:** 0.1.0 copies older than the `FORMAT` mark do not read it. A session with one of those copies can keep writing in a folder of a newer format; the warning only protects from 1.0.0 on.

## Security and privacy

- Never store secrets or personal data in tasks, logs or screenshots. Wayfinder rejects the most common secret patterns, but it is a help, not a guarantee.
- Keep the data folder private and without a remote. Wayfinder never runs `push`.
- Task content is treated as untrusted data: Claude does not follow instructions written inside it.
- Registering a repository, approving a proposal or opening the web board needs your own words in the chat: "register this project", "approve WAY-n" (or "approve" after the review), "open Wayfinder". The hook detects them in your message, so a "yes", or the text of a task Claude reads, is not enough.
  - It is a best-effort protection, like the secret detector.
  - Claude Code also starts turns you do not write. Notices from background tasks and subagents do not count as an order. A scheduled task (`/loop` or a Claude task) arrives as plain text and Wayfinder cannot tell it apart from a message of yours: do not schedule tasks with "approve WAY-n" and similar.
  - A message that another Claude Code session sends to this one counts as yours, so that the main session can forward your orders to another one. Because of that, any session that can write to this one (those on your PC and, with Remote Control, those on other computers) can give an order in your name. The proposal review and the second confirmation on suspicious signals still apply.
  - A manipulated Claude that can run commands could bypass it by writing directly into Wayfinder's state. And when the web board opens on the network, Claude receives the link with the key to give it to you, so it could also use it to write or approve from the web board. The skill forbids it to use it, but that is not a technical barrier.
  - Two best-effort barriers remain: the local page only hands out the key to requests from the browser itself, and the hook blocks calls that ask for it or carry it in `k=`. The hook looks at Bash and PowerShell commands and, in Claude Code's built-in browser, in Claude in Chrome and in the MCP terminal, at the tools that carry an address, code or a command (`navigate`, `preview_start`, `javascript_tool`, `browser_batch` and `run_in_terminal`). It does not look at the other browser tools, such as `computer`, which clicks in a tab that is already open, and it cannot handle code that hides what it asks for. Nor do they stop Claude from knowing the key when the web board is on the network.
  - If you work with automatic permissions, review which commands it runs.
  - Someone else's text that you paste without quoting it (`>`) or putting it in a code block counts as yours.
- If the web board only opens on this PC, Claude receives the address without the key. If it opens on the network, it also receives the link for other devices, which carries the key and stays in the conversation history until that key expires when the session closes. Any program on your PC can read the local page, just as it can read your data folder.
- Outside your PC the web board asks for the key for everything and is not encrypted: use it on your home network or with Tailscale, and do not share the link.

## Accessibility

The web board was audited in November 2026 (WAY-28), and its eight findings were fixed: the "Skip to content" link, the project picker keeping the focus, a page title per view, the focus going back to the error you opened, the heading levels of the project page, `lang="en"` on the stored English labels inside the Spanish interface, 44 px tap targets on phones, and the count of done tasks.

- **Checked** with Chromium (Playwright) on Windows, in Spanish and English: the main flows with the keyboard, contrast in light and dark mode, reflow at 320 px, zoom emulated at 200 %, text spacing, names and roles, dialogs and reduced motion. `e2e/a11y.spec.ts` covers the fixes.
- **Not checked:** screen readers (NVDA or others), Windows high contrast mode, real browser zoom, Firefox, Edge and Safari, and real touch devices.

## Development

```powershell
npm ci
npm run typecheck
npm test              # unit and integration tests (builds first)
npm run test:e2e      # Playwright
npm run test:docker   # needs Docker Desktop and the wayfinder:dev image
npm run check:dist    # dist/ and plugin/dist/ up to date; git without network subcommands; a single version
npm run test:acceptance  # release walkthrough in temporary folders; needs the claude CLI (docs/aceptacion-1.0.md)
```

The plugin lives in `plugin/`, with `plugin/dist/` under version control. The marketplace is in `.claude-plugin/marketplace.json`.

## Docker

The image serves the local web board and, as a variant, the MCP server over stdio. It is not published in any registry: you build it on your computer. The examples are for PowerShell on Windows with Docker Desktop.

```powershell
docker build -t wayfinder:dev https://github.com/davidgarciai554/wayfinder.git#main
```

From a local copy of the repository: `docker build -t wayfinder:dev .`

The image declares no volume. Always mount your data folder at `/data`; without it, `serve` and `mcp` exit with an error.

### Creating the data folder (`init`)

Only if it does not exist yet. If you already use Wayfinder outside Docker, mount the same folder.

```powershell
docker run --rm -v "$env:USERPROFILE\.wayfinder:/data" --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges wayfinder:dev init --lang en
```

### Web board

```powershell
docker run --rm -p 127.0.0.1:4747:4747 -e WAYFINDER_PUBLIC_PORT=4747 `
  -v "$env:USERPROFILE\.wayfinder:/data" `
  --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges `
  wayfinder:dev
```

- Open the link it prints, `http://127.0.0.1:4747/?k=…`: it carries the key of that start. Since inside the container the web board listens on `0.0.0.0`, without the key it does not even allow reading: it shows an access page. A link from an earlier start warns that it is no longer valid.
- Publish the port **only on `127.0.0.1`** and do not use `--network host`. Inside the container the web board listens on `0.0.0.0` (that is why it warns at start), but it is only published on this computer.
- If you change the published port, change `WAYFINDER_PUBLIC_PORT` too; the web board only accepts requests addressed to that port.
- The key shows up in `docker logs`: do not share those logs.
- The container detects changes by polling (`--poll`), because file change notifications are not reliable in mounted folders.
- Language: `-e WAYFINDER_LANG=en`.

### MCP server over stdio

For an MCP client that starts the container. The Claude Code plugin does **not** use this variant: it uses its own bundle.

```powershell
docker run -i --rm --network none --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges `
  -v "$env:USERPROFILE\.wayfinder:/data" -e WAYFINDER_PROJECT=<slug> `
  -v "<screenshots folder>:/captures:ro" -e WAYFINDER_CAPTURES_DIR=/captures `
  -v "<repository>:/workspace:ro" -e CLAUDE_PROJECT_DIR=/workspace `
  wayfinder:dev mcp
```

- Without `-t`, because stdout carries JSON-RPC.
- The project is always given with `WAYFINDER_PROJECT`.
- `wf_attach` only accepts container paths under `/captures`.
- The plan rule can only check `plan` if the repository is mounted at `/workspace`. Without it, moving a non-trivial task to `in-progress` fails with an explanation.
- Approval via chat needs the plugin hook that records the orders in the same data folder. Without it, it is rejected.

### Using it alongside the host

Writes from the host and from the container on the same folder share the same lock. Checked with Docker Desktop 29.9.2 on Windows 11: 20 alternating writes, no duplicate IDs.

### Removing the image

```powershell
docker image rm wayfinder:dev
```

The data folder mounted at `/data` is not touched. *Not checked: the Docker engine was not running when this section was written.*

### Verification

```powershell
npm run test:docker
```

Build the `wayfinder:dev` image first. The test needs the Docker engine running.
