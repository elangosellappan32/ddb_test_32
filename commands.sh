# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit"

# Add GitHub repository as remote
git remote add origin <your-github-repo-url>

# Push to GitHub
git push -u origin main
