"""
Management command to find and fix invalid breaks in work entries.
Invalid breaks are those outside the work time window.

Usage:
    python manage.py fix_invalid_breaks --dry-run  # Preview changes
    python manage.py fix_invalid_breaks            # Actually clear invalid breaks
"""
from django.core.management.base import BaseCommand
from apps.worklogs.models import WorkEntry
from datetime import time as dt_time


class Command(BaseCommand):
    help = 'Find and fix work entries with breaks outside the work time window'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be changed without making modifications',
        )

    def is_break_valid(self, break_start_str, break_end_str, work_start_time, work_end_time, is_overnight):
        """Check if a break falls within the work time window."""
        try:
            # Parse break times (format: HH:MM or HH:MM:SS)
            break_start_parts = break_start_str.split(':')
            break_end_parts = break_end_str.split(':')
            break_start = dt_time(int(break_start_parts[0]), int(break_start_parts[1]))
            break_end = dt_time(int(break_end_parts[0]), int(break_end_parts[1]))
            
            if is_overnight:
                # For overnight shifts (e.g., 21:00-05:00):
                # Valid if break is in evening part [work_start, 23:59] OR morning part [00:00, work_end]
                break_in_evening = break_start >= work_start_time and break_end >= work_start_time
                break_in_morning = break_start <= work_end_time and break_end <= work_end_time
                return break_in_evening or break_in_morning
            else:
                # Same-day shift: break must be fully within work window
                return break_start >= work_start_time and break_end <= work_end_time
        except (ValueError, IndexError):
            # Invalid format, consider it invalid
            return False

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        # Find all work entries with breaks
        entries_with_breaks = WorkEntry.objects.exclude(breaks__isnull=True).exclude(breaks=[])
        
        self.stdout.write(f'Found {entries_with_breaks.count()} work entries with breaks')
        
        invalid_count = 0
        fixed_count = 0
        
        for entry in entries_with_breaks:
            if not entry.actual_start_datetime or not entry.actual_end_datetime:
                continue
                
            work_start_time = entry.actual_start_datetime.time()
            work_end_time = entry.actual_end_datetime.time()
            is_overnight = entry.actual_end_datetime.date() > entry.actual_start_datetime.date()
            
            # Check each break
            breaks = entry.breaks or []
            if not isinstance(breaks, list):
                continue
                
            valid_breaks = []
            has_invalid = False
            
            for brk in breaks:
                if not isinstance(brk, dict):
                    continue
                    
                break_start = brk.get('start', '')
                break_end = brk.get('end', '')
                
                if not break_start or not break_end:
                    continue
                
                if self.is_break_valid(break_start, break_end, work_start_time, work_end_time, is_overnight):
                    valid_breaks.append(brk)
                else:
                    has_invalid = True
                    self.stdout.write(
                        self.style.ERROR(
                            f'  Entry #{entry.id} ({entry.employee.full_name if entry.employee else "?"}, '
                            f'{entry.work_date}): Invalid break {break_start}-{break_end} '
                            f'not in work hours {work_start_time.strftime("%H:%M")}-{work_end_time.strftime("%H:%M")}'
                            f'{" (overnight)" if is_overnight else ""}'
                        )
                    )
                    invalid_count += 1
            
            # Fix by clearing invalid breaks
            if has_invalid:
                if not dry_run:
                    entry.breaks = valid_breaks if valid_breaks else []
                    entry.save(update_fields=['breaks'])
                    fixed_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'    Fixed: Cleared invalid breaks, keeping {len(valid_breaks)} valid breaks')
                    )
                else:
                    self.stdout.write(
                        f'    Would clear invalid breaks, keeping {len(valid_breaks)} valid breaks'
                    )
        
        self.stdout.write('')
        self.stdout.write(self.style.NOTICE(f'Summary:'))
        self.stdout.write(f'  Total entries with breaks: {entries_with_breaks.count()}')
        self.stdout.write(f'  Invalid breaks found: {invalid_count}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f'  Would fix: {invalid_count} entries (dry run)'))
            self.stdout.write('')
            self.stdout.write('Run without --dry-run to apply fixes')
        else:
            self.stdout.write(self.style.SUCCESS(f'  Fixed: {fixed_count} entries'))
