-- Read-only operator check. An active job does not prove that every close succeeded.
select j.jobname,j.schedule,j.active,
  (select max(d.start_time) from cron.job_run_details d where d.jobid=j.jobid) as last_start,
  (select d.status from cron.job_run_details d where d.jobid=j.jobid order by d.start_time desc limit 1) as last_status,
  (select count(*) from public.lite_cycles c where c.status='open' and c.paused_at is null
    and c.ends_at < clock_timestamp() - interval '30 seconds') as overdue_cycles
from cron.job j where j.jobname='side-lite-sql-close-v2';
