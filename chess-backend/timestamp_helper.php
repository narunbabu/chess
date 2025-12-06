<?php

/**
 * Local Timestamp Helper
 *
 * Provides timestamp functions with local timezone support
 * Use this instead of date() for local timestamps in backup files
 */

class LocalTimestamp
{
    private static string $timezone = 'Asia/Kolkata'; // IST timezone

    /**
     * Get current timestamp in local timezone
     */
    public static function format(string $format = 'Y_m_d_His'): string
    {
        $timezone = new DateTimeZone(self::$timezone);
        $datetime = new DateTime('now', $timezone);
        return $datetime->format($format);
    }

    /**
     * Get current timestamp for backup files
     */
    public static function backupTimestamp(): string
    {
        return self::format('Y_m_d_His');
    }

    /**
     * Get current datetime string for display
     */
    public static function displayDateTime(): string
    {
        return self::format('Y-m-d H:i:s');
    }

    /**
     * Set timezone (optional, defaults to Asia/Kolkata)
     */
    public static function setTimezone(string $timezone): void
    {
        self::$timezone = $timezone;
    }

    /**
     * Get current timezone
     */
    public static function getTimezone(): string
    {
        return self::$timezone;
    }
}

