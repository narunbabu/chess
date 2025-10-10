[Echo] Connecting to WebSocket...
3WebSocketGameService.js:83 [WS] Attempting to connect...
echoSingleton.js:80 [Echo] Successfully connected. Socket ID: 16512883.621830894
3WebSocketGameService.js:92 [WS] ✅ Connected successfully. Socket ID: 16512883.621830894
5LobbyPage.js:88 [Lobby] ✅ Successfully subscribed to user channel: App.Models.User.1
LobbyPage.js:508 Attempting to accept invitation 4
LobbyPage.js:509 Auth token exists: true
LobbyPage.js:510 Current user: {id: 1, name: 'Arun Nalamara', email: 'nalamara.arun@gmail.com', email_verified_at: null, provider: 'google', …}
LobbyPage.js:511 Sending invitation response: {invitationId: 4, action: 'accept', colorChoice: 'black'}
LobbyPage.js:520 Invitation response successful: {message: 'Accepted', game: {…}, player_color: 'black'}
LobbyPage.js:529 Invitation accepted, navigating to game: {white_player_id: 2, black_player_id: 1, status_id: 1, result: 'ongoing', updated_at: '2025-10-04T02:35:06.000000Z', …}
LobbyPage.js:165 [Lobby] Cleaning up user channel listeners
PlayMultiplayer.js:701 🚀 Initializing game (first time)
PlayMultiplayer.js:160 Game access check: {gameId: '4', userId: 1, lastInvitationAction: 'accepted', lastInvitationTime: '1759545307028', timeSinceInvitation: 5}
PlayMultiplayer.js:706 🧹 Cleanup: disconnecting WebSocket
PlayMultiplayer.js:696 ⚠️ Skipping duplicate initialization (React StrictMode)
PlayMultiplayer.js:198 Raw game data from backend: {id: 4, white_player_id: 2, black_player_id: 1, result: 'ongoing', winner_player: null, …}
PlayMultiplayer.js:199 🎨 MY PLAYER COLOR FROM BACKEND: black
PlayMultiplayer.js:200 🎨 MY USER ID: 1
PlayMultiplayer.js:201 🎨 WHITE PLAYER ID: 2
PlayMultiplayer.js:202 🎨 BLACK PLAYER ID: 1
PlayMultiplayer.js:207 🚫 Game is already finished, status: undefined
PlayMultiplayer.js:236 ✅ Game finished, marked to prevent auto-navigation loop