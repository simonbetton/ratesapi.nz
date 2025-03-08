# Monitoring

API uptime is monitored every 15 minutes via GitHub Actions. The workflow checks the health of all endpoints and alerts through GitHub Issues:

1. Creates a new issue when endpoints are down
2. Mentions repository owner to trigger a notification
3. Labels issues as "incident" and "high-priority"
4. Includes detailed information about failed endpoints

The following endpoints are monitored:
- API Root
- Mortgage rates (list and by institution)
- Personal loan rates (list and by institution)
- Car loan rates (list and by institution)
- Credit card rates (list and by issuer)
- API documentation

## GitHub Notifications
The notification system uses GitHub's built-in @mentions to alert team members. Users will receive notifications according to their GitHub notification preferences (email, web, mobile).

To ensure you receive timely alerts:
1. Check your GitHub notification settings at https://github.com/settings/notifications
2. Enable notifications for "Issues" activity
3. Configure your preferred notification method (web, email, mobile)

## Required Permissions
The GitHub Action requires specific permissions to create issues and add labels. These permissions are already configured in the workflow file:

```yaml
# Required permissions for creating issues and using labels
permissions:
  issues: write
  contents: read
```

If you're using an organization with restricted permissions, ensure that:

1. The repository settings allow GitHub Actions to create issues
   - Go to repository Settings > Actions > General
   - Under "Workflow permissions", select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"
   - Click "Save"

2. Create the required labels in your repository:
   - Go to repository Issues > Labels
   - Create "incident" and "high-priority" labels if they don't exist