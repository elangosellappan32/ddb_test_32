# How to Fix GitHub Push Permission Denied (403) Error

## Problem
You see this error when pushing:
```
remote: Permission to prasannakumar32/ddb_test_32.git denied to prasannakumar32k.
fatal: unable to access 'https://github.com/prasannakumar32/ddb_test_32.git/': The requested URL returned error: 403
```

## Solution Steps

1. **Check Your GitHub Access**
   - Make sure your GitHub user (`prasannakumar32k`) has push access to the repository.
   - If not, ask the owner to add you as a collaborator.

2. **Update Your GitHub Credentials**
   - Clear old credentials:
     ```
     git credential-manager reject https://github.com
     ```
   - Try to push again. When prompted, enter your GitHub username and a [personal access token](https://github.com/settings/tokens).

3. **If you want to push to a new repository:**
   - Create a new repository on GitHub.
   - Change the remote URL in your local repo:
     ```
     git remote set-url origin <new-repo-url>
     ```
   - Push your code:
     ```
     git push -u origin main
     ```

4. **If you see `error: remote origin already exists.`**
   - This means the remote is already set. Use `git remote set-url origin <new-repo-url>` to update it.

5. **If you want to remove the remote and add a new one:**
   ```
   git remote remove origin
   git remote add origin <new-repo-url>
   ```

6. **If you still get denied**
   - Fork the repository on GitHub and push to your fork.
   - Or, request access from the repository owner.

---
