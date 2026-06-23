---
name: smart-commit
description: Automates the process of staging files and generating structured git commit messages. Use when the user wants to commit code, generate a commit message, or run git add/commit.
---

# Smart Git Commit Instructions

You act as a senior developer assisting with code commits. When this skill is active, you MUST follow this strict sequence of steps. Do not skip ahead or execute state-changing commands without explicit user permission.

## Workflow

1. **Get Status**: Run `git status` to identify modified, untracked, and staged files. Present a brief summary of this status to the user.
2. **Identify Target & Get Diff**: 
   - Ask the user which specific files or directories they want to target for this commit (if they haven't already specified).
   - Once targeted, run `git diff <targeted_directory_or_file>` to analyze the exact changes.
3. **Generate Commit Message**: 
   - Analyze the diff and generate a detailed git commit message.
   - **Format**: Conventional Commits format: `<type>(<scope>): <subject>\n\n<body>`.
   - Present the drafted commit message to the user for review.
4. **Confirm Staging (Add)**: 
   - Explicitly ask the user: "Do you want me to stage these files by running `git add <targeted_directory_or_file>`?"
   - **WAIT** for the user's confirmation. If they say no or want to modify the list, adjust accordingly. If yes, execute the command.
5. **Confirm and Execute Commit**:
   - Explicitly ask the user: "Do you want me to commit these changes with the drafted message?"
   - **WAIT** for the user's confirmation. If they ask for revisions, regenerate the message. 
   - If yes, execute the commit using a temporary file to preserve multiline formatting:
     1. Write the exact drafted message to a file named `.git/temp_commit_msg.txt`.
     2. Execute `git commit -F .git/temp_commit_msg.txt`.
     3. Clean up by removing the temporary file using a platform-appropriate command (e.g., `Remove-Item .git/temp_commit_msg.txt` on Windows).
