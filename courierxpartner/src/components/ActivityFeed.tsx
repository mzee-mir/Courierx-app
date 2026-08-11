import { Box, Typography, Paper } from '@mui/material';
import { useFloorActivity } from '../hooks/useFloorActivity';
import { format } from 'date-fns';


export const ActivityFeed = () => {
  const { activities } = useFloorActivity();


  return (
    <Paper elevation={0} sx={{
      p: 3, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)', height: '400px', display: 'flex', flexDirection: 'column'
    }}>
      <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, letterSpacing: '0.2em' }}>
        LIVE_TERMINAL_FEED
      </Typography>

      <Box sx={{ flex: 1, overflowY: 'auto', spaceY: 2 }} className="scrollbar-hide">
        {activities.length === 0 && (
          <Typography sx={{ color: '#222', fontFamily: 'monospace', fontSize: '0.7rem', textAlign: 'center', mt: 10 }}>
            WAITING_FOR_PHYSICAL_INTAKE...
          </Typography>
        )}
        {activities.map((log, i) => (
          <Box key={i} sx={{ p: 1.5, borderLeft: '2px solid #0052FF', bgcolor: 'rgba(255,255,255,0.01)', mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 900, color: 'white' }}>
                {log.trackingId} // {log.customerName}
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.secondary' }}>
                {format(new Date(log.timestamp), 'HH:mm:ss')}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 700, mt: 0.5 }}>
              STATUS: {log.status} | OP: {log.staffName}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};
