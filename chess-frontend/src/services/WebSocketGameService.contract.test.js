import WebSocketGameService from './WebSocketGameService';
import { joinChannel } from './echoSingleton';

jest.mock('./echoSingleton', () => ({ getEcho: jest.fn(), joinChannel: jest.fn(), leaveChannel: jest.fn() }));

async function connect() {
  const callbacks = {};
  const channel = { subscribed: jest.fn().mockReturnThis(), error: jest.fn().mockReturnThis(),
    listen: jest.fn((name, callback) => { callbacks[name] = callback; return channel; }) };
  joinChannel.mockReturnValue(channel);
  const service = new WebSocketGameService();
  service.echo = {};
  service.gameId = 51;
  service.user = { id: 42 };
  service.waitForConnection = jest.fn().mockResolvedValue();
  service.completeHandshake = jest.fn().mockResolvedValue();
  await service.joinGameChannel();
  return { service, callbacks };
}

test.each([
  ['.game.undo.request', 'undoRequest'],
  ['.game.undo.accepted', 'undoAccepted'],
  ['.game.undo.declined', 'undoDeclined'],
])('actual channel listener %s dispatches %s', async (wireName, localName) => {
  const { service, callbacks } = await connect();
  const received = jest.fn();
  service.on(localName, received);
  const payload = { game_id: 51, requested_by_user_id: 7, fen: 'server position' };
  expect(callbacks[wireName]).toEqual(expect.any(Function));
  callbacks[wireName](payload);
  expect(received).toHaveBeenCalledWith(payload);
  expect(callbacks[wireName.replace('.game.', '.')]).toBeUndefined();
});

test('draw self-echo uses identity, including string IDs, and opponent event is delivered', async () => {
  const { service, callbacks } = await connect();
  const received = jest.fn();
  const declined = jest.fn();
  service.on('drawOfferReceived', received);
  service.on('drawOfferDeclined', declined);
  callbacks['.draw.offer.sent']({ offerer_id: '42' });
  expect(received).not.toHaveBeenCalled();
  callbacks['.draw.offer.sent']({ offerer_id: 7 });
  expect(received).toHaveBeenCalledTimes(1);
  callbacks['.draw.offer.declined']({ offerer_id: '42' });
  expect(declined).toHaveBeenCalledTimes(1);
});
