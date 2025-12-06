# Laravel Log Rotation Setup

## Overview

This document describes the automatic log rotation system configured for the Chess Web application to manage disk space and maintain optimal performance.

## Features

✅ **Daily Log Rotation**: Automatically creates timestamped log files daily
✅ **Compression**: Compresses old logs after 7 days to save disk space
✅ **Auto Cleanup**: Removes very old logs after 30 days
✅ **Space Efficient**: Achieves 80-90% compression ratio on typical log files
✅ **Scheduled**: Runs automatically at midnight via Laravel scheduler

## Configuration

### Environment Variables (.env)

```env
LOG_CHANNEL=daily
LOG_STACK=daily
LOG_LEVEL=debug
LOG_DAILY_DAYS=7
```

### Log Rotation Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Rotation** | Daily | Creates new log file each day at midnight |
| **Compression** | 7 days | Compress logs older than 7 days |
| **Cleanup** | 30 days | Delete all logs older than 30 days |
| **Compression** | gzip | Uses gzip compression (~85% reduction) |

## Usage

### Manual Commands

```bash
# Standard rotation (compress after 7 days, cleanup after 30)
php artisan logs:rotate

# Force immediate rotation of current log
php artisan logs:rotate --force

# Custom compression and cleanup periods
php artisan logs:rotate --compress=3 --cleanup=14

# Rotate all logs immediately and cleanup everything
php artisan logs:rotate --compress=0 --cleanup=0
```

### Automatic Scheduling

The system is configured to run automatically:

```bash
# The Laravel scheduler runs every minute via cron
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1

# Log rotation specifically runs at midnight
0 0 * * * php artisan logs:rotate
```

## Setup

### Initial Setup

```bash
# Run the setup script (creates cron job, tests system)
./setup_log_rotation.sh

# Or manual setup:
php artisan config:clear
php artisan cache:clear
crontab -e  # Add: * * * * * cd /path && php artisan schedule:run
```

### Testing

```bash
# Test with a large log file
php test_large_log_rotation.php

# Test manual rotation
php artisan logs:rotate --force
```

## File Structure

After rotation, your logs directory will look like:

```
storage/logs/
├── laravel.log                 # Current day's log
├── laravel-2025-12-06.log      # Recent logs (< 7 days)
├── laravel-2025-12-05.log      # Recent logs (< 7 days)
├── laravel-2025-11-30.log.gz   # Compressed logs (7-30 days)
├── laravel-2025-11-29.log.gz   # Compressed logs (7-30 days)
└── ...                         # Older logs are automatically deleted
```

## Performance Impact

### Memory Usage
- **Low**: Processes logs in 512KB chunks
- **Efficient**: Streams compression to minimize memory footprint
- **Background**: Runs during off-peak hours (midnight)

### CPU Usage
- **Minimal**: gzip compression is CPU-efficient
- **Fast**: Typical 32MB log file processes in < 1 second
- **Scheduled**: Runs during low-traffic periods

### Disk Savings
```
Example 32MB log file:
├── Original:   32.0 MB
├── Compressed:  4.8 MB  (85% reduction)
└── Space Saved: 27.2 MB
```

## Monitoring

### Check Log Status

```bash
# Current log size
ls -lh storage/logs/laravel.log

# All logs summary
php artisan logs:rotate --help

# Manual status check
php artisan logs:status  # Custom command can be created if needed
```

### Log Directory Monitoring

```bash
# Total disk usage
du -sh storage/logs/

# File breakdown
ls -lah storage/logs/laravel*

# Compressed vs uncompressed
find storage/logs/ -name "*.log" -exec ls -h {} \;
find storage/logs/ -name "*.log.gz" -exec ls -h {} \;
```

## Troubleshooting

### Common Issues

#### 1. Log Rotation Not Running
```bash
# Check if cron job exists
crontab -l | grep "schedule:run"

# Test scheduler manually
php artisan schedule:run

# Check Laravel logs for errors
tail -f storage/logs/laravel.log
```

#### 2. Large Log Files Still Present
```bash
# Force rotation
php artisan logs:rotate --force

# Check file permissions
ls -la storage/logs/

# Manually rotate with aggressive settings
php artisan logs:rotate --compress=0 --cleanup=7
```

#### 3. Compression Not Working
```bash
# Test compression on a single file
gzip -t storage/logs/laravel-YYYY-MM-DD.log

# Check disk space
df -h

# Verify gzip is available
which gzip
```

### Debug Mode

```bash
# Verbose output
php artisan logs:rotate -v

# Debug specific dates
php artisan logs:rotate --compress=1 --cleanup=3
```

## Security Considerations

1. **File Permissions**: Ensure logs have appropriate permissions (0644)
2. **Sensitive Data**: Logs may contain sensitive information, handle backups securely
3. **Access Control**: Restrict access to log files (web server should not serve them)
4. **Retention**: Follow your organization's data retention policies

### Web Server Configuration (Apache/Nginx)

```apache
# Prevent log files from being accessed via web
<Directory "/path/to/storage/logs">
    Require all denied
    Order deny,allow
    Deny from all
</Directory>
```

```nginx
# Prevent log files from being accessed via web
location ~* /storage/logs/ {
    deny all;
    return 404;
}
```

## Backup and Recovery

### Backup Current Logs
```bash
# Create backup before rotation
cp -r storage/logs backup_logs_$(date +%Y%m%d)

# Use the database backup script that also backs up logs
php database_backup.php backup
```

### Restore from Backup
```bash
# Restore logs from backup
cp backup_logs_YYYYMMDD/laravel* storage/logs/
```

## Customization

### Modify Rotation Schedule

Edit `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule): void
{
    // Run every 6 hours instead of daily
    $schedule->command('logs:rotate')->everySixHours();

    // Run at specific time
    $schedule->command('logs:rotate')->dailyAt('02:30');
}
```

### Modify Compression Settings

Default settings are in the command, but can be overridden:

```php
// In app/Console/Commands/LogRotation.php
protected $defaultCompressDays = 7;
protected $defaultCleanupDays = 30;
```

### Custom Log Channels

For different log channels, create custom rotation commands:

```bash
# Rotate specific log channels
php artisan logs:rotate --channel=api --channel=auth
```

## Integration with Monitoring

### Monitor Disk Usage
```bash
# Create alert script
#!/bin/bash
LOG_SIZE=$(du -s storage/logs/ | cut -f1)
if [ $LOG_SIZE -gt 1048576 ]; then  # 1GB
    echo "Alert: Log directory exceeds 1GB"
    php artisan logs:rotate --force
fi
```

### Integrate with Application Monitoring
Add to your monitoring system:
- Log file size alerts
- Failed rotation alerts
- Disk usage trends

## Production Checklist

- [ ] Verify cron job is configured
- [ ] Test manual rotation
- [ ] Check disk space availability
- [ ] Configure monitoring alerts
- [ ] Review retention periods
- [ ] Test backup/restore procedures
- [ ] Verify web server blocks log access
- [ ] Check log file permissions
- [ ] Configure appropriate log levels
- [ ] Document custom settings

## Support

For issues with the log rotation system:

1. Check Laravel logs: `tail -f storage/logs/laravel.log`
2. Verify permissions: `ls -la storage/logs/`
3. Test manually: `php artisan logs:rotate --force`
4. Check cron jobs: `crontab -l`
5. Verify disk space: `df -h`

## Version History

- **v1.0** (2025-12-06): Initial implementation with daily rotation, compression, and cleanup
- Features: gzip compression, configurable retention periods, Laravel scheduler integration