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

3. **Set the Correct Git User (Optional)**
   - Check your current user:
     ```
     git config --get user.name
     git config --get user.email
     ```
   - Set your user if needed:
     ```
     git config --global user.name "your-username"
     git config --global user.email "your-email@example.com"
     ```

4. **Push Your Code**
   ```
   git add .
   git commit -m "your commit message"
   git push -u origin main
   ```

5. **If You Still Get Denied**
   - Fork the repository on GitHub and push to your fork.
   - Or, request access from the repository owner.

---
