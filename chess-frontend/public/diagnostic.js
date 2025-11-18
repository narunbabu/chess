// Diagnostic script for debugging user status service
// Run this in browser console: fetch('/diagnostic.js').then(r=>r.text()).then(eval)

console.log('=== User Status Service Diagnostic ===\n');

// 1. Check localStorage
console.log('1. Auth Storage Check:');
const token = localStorage.getItem('auth_token');
const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
console.log('   - Has Token:', !!token);
console.log('   - Token Preview:', token ? token.substring(0, 20) + '...' : 'none');
console.log('   - User:', user ? { id: user.id, name: user.name } : 'none');

// 2. Check if service is exposed
console.log('\n2. Service Exposure Check:');
console.log('   - window.userStatusService:', window.userStatusService);
console.log('   - isActive:', window.userStatusService?.isActive);
console.log('   - heartbeatInterval:', window.userStatusService?.heartbeatInterval);

// 3. Try to manually send heartbeat
console.log('\n3. Manual Heartbeat Test:');
if (window.userStatusService) {
    console.log('   - Service found, attempting heartbeat...');
    window.userStatusService.sendHeartbeat()
        .then(result => {
            console.log('   - Heartbeat SUCCESS:', result);
        })
        .catch(error => {
            console.error('   - Heartbeat FAILED:', error.message);
            console.error('   - Error details:', error);
        });
} else {
    console.log('   - ❌ Service not exposed on window object');
}

// 4. Check network requests
console.log('\n4. Network Check:');
console.log('   - Open Network tab and filter for "heartbeat"');
console.log('   - You should see POST requests to /status/heartbeat every 60 seconds');

// 5. Manual API test
console.log('\n5. Direct API Test:');
if (token) {
    fetch('http://localhost:8001/api/status/heartbeat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('   - Direct heartbeat API call SUCCESS:', data);
    })
    .catch(error => {
        console.error('   - Direct heartbeat API call FAILED:', error.message);
    });
} else {
    console.log('   - ❌ No auth token, cannot test API');
}

console.log('\n=== Diagnostic Complete ===');
console.log('If service is not active:');
console.log('1. Check browser console for App.js initialization logs');
console.log('2. Check if React dev server is running (npm start)');
console.log('3. Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)');
