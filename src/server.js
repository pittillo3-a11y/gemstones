const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '../data/game.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    exits TEXT
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    room_id INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 40,
    max_hp INTEGER DEFAULT 40
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    room_id INTEGER,
    player_id INTEGER,
    location TEXT DEFAULT 'room',
    wearable INTEGER DEFAULT 0,
    worn INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS creatures (
    id INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    room_id INTEGER,
    hp INTEGER DEFAULT 10,
    max_hp INTEGER DEFAULT 10
  );
`);

try { db.exec('ALTER TABLE items ADD COLUMN wearable INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE items ADD COLUMN worn INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE players ADD COLUMN hp INTEGER DEFAULT 40'); } catch(e) {}
try { db.exec('ALTER TABLE players ADD COLUMN max_hp INTEGER DEFAULT 40'); } catch(e) {}

function ensureRoom(id, name, description, exits) {
  const exists = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
  if (!exists) {
    db.prepare('INSERT INTO rooms (id, name, description, exits) VALUES (?, ?, ?, ?)').run(
      id, name, description, JSON.stringify(exits)
    );
  }
}

ensureRoom(1, 'Town Square',
  'You stand in the heart of a small human town. Cobblestones underfoot, a few wooden buildings around you, and the smell of bread from a nearby inn. Paths lead out in several directions.',
  { north: 2, east: 3, south: 4 });
ensureRoom(2, 'North Road',
  'A dirt road stretches north out of town. Fields and low hills are visible in the distance.',
  { south: 1 });
ensureRoom(3, 'East Alley',
  'A narrow alley between two buildings. A cat watches you from a crate.',
  { west: 1 });
ensureRoom(4, 'South Gate',
  'The southern gate of the town. Beyond the open doors a worn path leads toward a low hill.',
  { north: 1, south: 5 });
ensureRoom(5, 'Hill Path',
  'A narrow path climbs a grassy hill. At the top you can see a dark opening in the rock.',
  { north: 4, south: 6 });
ensureRoom(6, 'Dungeon Entrance',
  'A rough stone archway opens into darkness. Cool air drifts out, carrying the smell of damp earth. A short flight of steps leads down.',
  { north: 5, down: 7 });
ensureRoom(7, 'Upper Corridor',
  'A low stone corridor. Torches in iron brackets give a weak, flickering light. The passage runs east and west.',
  { up: 6, east: 8, west: 9 });
ensureRoom(8, 'Guard Chamber',
  'A small chamber that once held guards. A broken table and a couple of rotting stools remain. An old shield hangs on the wall.',
  { west: 7 });
ensureRoom(9, 'West Passage',
  'The corridor narrows here. Water drips somewhere ahead. The way continues west into deeper shadow.',
  { east: 7, west: 10 });
ensureRoom(10, 'Collapsed Room',
  'Part of the ceiling has fallen in. Rubble covers the floor. A single intact doorway stands on the far side, but it is blocked by stone.',
  { east: 9 });

const itemCount = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
if (itemCount === 0) {
  db.prepare(`INSERT INTO items (name, description, room_id, location, wearable) VALUES (?, ?, ?, 'room', 0)`).run(
    'rusty sword', 'A worn short sword with a few notches in the blade.', 1
  );
  db.prepare(`INSERT INTO items (name, description, room_id, location, wearable) VALUES (?, ?, ?, 'room', 1)`).run(
    'leather backpack', 'A simple leather pack with room for a few items.', 1
  );
}
db.prepare(`UPDATE items SET wearable = 1 WHERE lower(name) LIKE '%backpack%'`).run();
db.prepare(`UPDATE items SET wearable = 1 WHERE lower(name) LIKE '%shield%'`).run();

function ensureItem(name, description, roomId, wearable = 0) {
  const exists = db.prepare('SELECT id FROM items WHERE lower(name) = ? AND room_id = ?').get(name.toLowerCase(), roomId);
  if (!exists) {
    db.prepare(`INSERT INTO items (name, description, room_id, location, wearable) VALUES (?, ?, ?, 'room', ?)`).run(
      name, description, roomId, wearable
    );
  }
}
ensureItem('old shield', 'A battered wooden shield with faded paint.', 8, 1);
ensureItem('torch', 'A simple wooden torch. It is not lit.', 7, 0);

function ensureCreature(name, description, roomId, hp) {
  const exists = db.prepare('SELECT id FROM creatures WHERE name = ?').get(name);
  if (!exists) {
    db.prepare(`INSERT INTO creatures (name, description, room_id, hp, max_hp) VALUES (?, ?, ?, ?, ?)`).run(
      name, description, roomId, hp, hp
    );
  }
}
ensureCreature('giant rat', 'A large, mangy rat with yellow teeth. It glares at you and squeaks aggressively.', 7, 12);
ensureCreature('skeleton', 'A humanoid skeleton clutching a rusty short sword. Its eye sockets glow faintly.', 8, 18);

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, '../public/index.html')));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server });
const clients = new Map();

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function getRoom(id) {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

function getItemsInRoom(roomId) {
  return db.prepare(`SELECT * FROM items WHERE room_id = ? AND location = 'room'`).all(roomId);
}

function getPlayerItems(playerId) {
  return db.prepare(`SELECT * FROM items WHERE player_id = ? AND location = 'inventory'`).all(playerId);
}

function describeRoom(room) {
  const exits = JSON.parse(room.exits || '{}');
  const exitList = Object.keys(exits).join(', ') || 'none';
  const items = getItemsInRoom(room.id);
  const creatures = db.prepare(`SELECT * FROM creatures WHERE room_id = ? AND hp > 0`).all(room.id);
  let extra = '';
  if (items.length) extra += '\nYou also see: ' + items.map(i => i.name).join(', ');
  if (creatures.length) extra += '\nCreatures here: ' + creatures.map(c => c.name).join(', ');
  return `${room.name}\n${room.description}\nObvious exits: ${exitList}${extra}`;
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'login') {
      const name = (msg.name || 'Traveler').trim().slice(0, 20);
      if (!name) return;
      let player = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
      if (!player) {
        db.prepare('INSERT INTO players (name, room_id, hp, max_hp) VALUES (?, 1, 40, 40)').run(name);
        player = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
        send(ws, { type: 'text', text: `A new traveler arrives. Welcome, ${name}.` });
      } else {
        // bump old characters up to the new health if they were created earlier
        if ((player.max_hp || 0) < 40) {
          db.prepare('UPDATE players SET hp = 40, max_hp = 40 WHERE id = ?').run(player.id);
          player.hp = 40;
          player.max_hp = 40;
        }
        send(ws, { type: 'text', text: `Welcome back, ${name}.` });
      }
      clients.set(ws, player);
      const room = getRoom(player.room_id);
      send(ws, { type: 'text', text: describeRoom(room) });
      return;
    }

    const player = clients.get(ws);
    if (!player) return;

    if (msg.type === 'command') {
      const input = (msg.text || '').trim().toLowerCase();
      const parts = input.split(/\s+/);
      const verb = parts[0];

      if (verb === 'look' || verb === 'l') {
        const target = parts.slice(1).join(' ');
        if (!target) {
          const room = getRoom(player.room_id);
          send(ws, { type: 'text', text: describeRoom(room) });
        } else {
          const creature = db.prepare(
            `SELECT * FROM creatures WHERE room_id = ? AND hp > 0 AND lower(name) LIKE ?`
          ).get(player.room_id, `%${target}%`);
          if (creature) {
            send(ws, { type: 'text', text: `${creature.name}\n${creature.description}\nIt has ${creature.hp}/${creature.max_hp} health.` });
          } else {
            send(ws, { type: 'text', text: 'You do not see that here.' });
          }
        }
      }
      else if (verb === 'attack' || verb === 'kill') {
        const target = parts.slice(1).join(' ');
        if (!target) { send(ws, { type: 'text', text: 'Attack what?' }); return; }
        const creature = db.prepare(
          `SELECT * FROM creatures WHERE room_id = ? AND hp > 0 AND lower(name) LIKE ?`
        ).get(player.room_id, `%${target}%`);
        if (!creature) { send(ws, { type: 'text', text: 'You do not see that here.' }); return; }

        const dmg = Math.floor(Math.random() * 5) + 3;
        const newHp = creature.hp - dmg;
        let result = `You hit the ${creature.name} for ${dmg} damage.`;

        if (newHp <= 0) {
          db.prepare('UPDATE creatures SET hp = 0 WHERE id = ?').run(creature.id);
          result += `\nThe ${creature.name} dies!`;
          if (creature.name === 'giant rat') {
            db.prepare(`INSERT INTO items (name, description, room_id, location) VALUES (?, ?, ?, 'room')`).run(
              'rat tail', 'A long, hairless rat tail. It is still twitching.', player.room_id
            );
            result += `\nIt drops a rat tail.`;
          } else if (creature.name === 'skeleton') {
            db.prepare(`INSERT INTO items (name, description, room_id, location) VALUES (?, ?, ?, 'room')`).run(
              'bone fragment', 'A cracked piece of bone.', player.room_id
            );
            result += `\nIt drops a bone fragment.`;
          }
        } else {
          db.prepare('UPDATE creatures SET hp = ? WHERE id = ?').run(newHp, creature.id);
          result += ` It has ${newHp} health left.`;
          const bite = Math.floor(Math.random() * 4) + 1;
          const p = db.prepare('SELECT hp FROM players WHERE id = ?').get(player.id);
          const newPlayerHp = Math.max(0, (p.hp || 40) - bite);
          db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(newPlayerHp, player.id);
          result += `\nThe ${creature.name} strikes you for ${bite} damage. You have ${newPlayerHp} health.`;
        }
        send(ws, { type: 'text', text: result });
      }
      else if (verb === 'rest') {
        const p = db.prepare('SELECT hp, max_hp FROM players WHERE id = ?').get(player.id);
        const healed = Math.min(p.max_hp, (p.hp || 0) + 8);
        db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(healed, player.id);
        send(ws, { type: 'text', text: `You rest for a moment and recover. You have ${healed}/${p.max_hp} health.` });
      }
      else if (verb === 'go' || ['n','s','e','w','u','d','north','south','east','west','up','down'].includes(verb)) {
        let dir = verb === 'go' ? parts[1] : verb;
        const map = { n:'north', s:'south', e:'east', w:'west', u:'up', d:'down' };
        dir = map[dir] || dir;
        const room = getRoom(player.room_id);
        const exits = JSON.parse(room.exits || '{}');
        if (exits[dir]) {
          player.room_id = exits[dir];
          db.prepare('UPDATE players SET room_id = ? WHERE id = ?').run(player.room_id, player.id);
          const newRoom = getRoom(player.room_id);
          send(ws, { type: 'text', text: `You go ${dir}.\n\n${describeRoom(newRoom)}` });
        } else {
          send(ws, { type: 'text', text: 'You cannot go that way.' });
        }
      }
      else if (verb === 'get' || verb === 'take') {
        const itemName = parts.slice(1).join(' ');
        if (!itemName) { send(ws, { type: 'text', text: 'Get what?' }); return; }
        const item = db.prepare(
          `SELECT * FROM items WHERE room_id = ? AND location = 'room' AND lower(name) LIKE ?`
        ).get(player.room_id, `%${itemName}%`);
        if (!item) { send(ws, { type: 'text', text: 'You do not see that here.' }); return; }
        db.prepare(`UPDATE items SET room_id = NULL, player_id = ?, location = 'inventory', worn = 0 WHERE id = ?`)
          .run(player.id, item.id);
        send(ws, { type: 'text', text: `You pick up the ${item.name}.` });
      }
      else if (verb === 'drop') {
        const itemName = parts.slice(1).join(' ');
        if (!itemName) { send(ws, { type: 'text', text: 'Drop what?' }); return; }
        const item = db.prepare(
          `SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND lower(name) LIKE ?`
        ).get(player.id, `%${itemName}%`);
        if (!item) { send(ws, { type: 'text', text: 'You are not carrying that.' }); return; }
        db.prepare(`UPDATE items SET room_id = ?, player_id = NULL, location = 'room', worn = 0 WHERE id = ?`)
          .run(player.room_id, item.id);
        send(ws, { type: 'text', text: `You drop the ${item.name}.` });
      }
      else if (verb === 'wear') {
        const itemName = parts.slice(1).join(' ');
        if (!itemName) { send(ws, { type: 'text', text: 'Wear what?' }); return; }
        const item = db.prepare(
          `SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND lower(name) LIKE ?`
        ).get(player.id, `%${itemName}%`);
        if (!item) { send(ws, { type: 'text', text: 'You are not carrying that.' }); return; }
        if (!item.wearable) { send(ws, { type: 'text', text: 'You cannot wear that.' }); return; }
        db.prepare(`UPDATE items SET worn = 1 WHERE id = ?`).run(item.id);
        send(ws, { type: 'text', text: `You wear the ${item.name}.` });
      }
      else if (verb === 'remove') {
        const itemName = parts.slice(1).join(' ');
        if (!itemName) { send(ws, { type: 'text', text: 'Remove what?' }); return; }
        const item = db.prepare(
          `SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND worn = 1 AND lower(name) LIKE ?`
        ).get(player.id, `%${itemName}%`);
        if (!item) { send(ws, { type: 'text', text: 'You are not wearing that.' }); return; }
        db.prepare(`UPDATE items SET worn = 0 WHERE id = ?`).run(item.id);
        send(ws, { type: 'text', text: `You remove the ${item.name}.` });
      }
      else if (verb === 'inventory' || verb === 'i' || verb === 'inv') {
        const items = getPlayerItems(player.id);
        if (items.length === 0) {
          send(ws, { type: 'text', text: 'You are not carrying anything.' });
        } else {
          const lines = items.map(i => `  ${i.name}${i.worn ? ' (worn)' : ''}`);
          send(ws, { type: 'text', text: 'You are carrying:\n' + lines.join('\n') });
        }
      }
      else if (verb === 'health' || verb === 'hp') {
        const p = db.prepare('SELECT hp, max_hp FROM players WHERE id = ?').get(player.id);
        send(ws, { type: 'text', text: `You have ${p.hp}/${p.max_hp} health.` });
      }
      else if (verb === 'who') {
        send(ws, { type: 'text', text: 'You are the only one here for now.' });
      }
      else {
        send(ws, { type: 'text', text: 'Unknown command. Try: look, attack, rest, health, get, inventory' });
      }
    }
  });

  ws.on('close', () => clients.delete(ws));
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Gem Stones listening on port ${PORT}`);
});
