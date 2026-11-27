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
    worn INTEGER DEFAULT 0,
    container INTEGER DEFAULT 0,
    container_id INTEGER
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
try { db.exec('ALTER TABLE items ADD COLUMN container INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE items ADD COLUMN container_id INTEGER'); } catch(e) {}
try { db.exec('ALTER TABLE players ADD COLUMN hp INTEGER DEFAULT 40'); } catch(e) {}
try { db.exec('ALTER TABLE players ADD COLUMN max_hp INTEGER DEFAULT 40'); } catch(e) {}

function ensureRoom(id, name, description, exits) {
  const exists = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
  if (!exists) {
    db.prepare('INSERT INTO rooms (id, name, description, exits) VALUES (?, ?, ?, ?)').run(
      id, name, description, JSON.stringify(exits)
    );
  } else {
    db.prepare('UPDATE rooms SET name = ?, description = ?, exits = ? WHERE id = ?').run(
      name, description, JSON.stringify(exits), id
    );
  }
}

// Core town
ensureRoom(1, 'Town Square',
  'You stand in the heart of a small human town. Cobblestones underfoot, wooden buildings all around, and the smell of bread and smoke in the air.',
  { north: 11, south: 4, east: 12, west: 13 });
ensureRoom(4, 'South Gate',
  'The southern gate of the town stands open. A path leads out toward the hills.',
  { north: 1, south: 5 });
ensureRoom(5, 'Hill Path',
  'A narrow path climbs a grassy hill. A dark opening is visible ahead.',
  { north: 4, south: 6 });
ensureRoom(6, 'Dungeon Entrance',
  'A rough stone archway opens into darkness. Cool air drifts out.',
  { north: 5, down: 7 });
ensureRoom(7, 'Upper Corridor',
  'A low stone corridor lit by flickering torches.',
  { up: 6, east: 8, west: 9 });
ensureRoom(8, 'Guard Chamber',
  'An old guard chamber. Broken furniture and a shield on the wall.',
  { west: 7 });
ensureRoom(9, 'West Passage',
  'The corridor narrows. Water drips ahead.',
  { east: 7, west: 10 });
ensureRoom(10, 'Collapsed Room',
  'Rubble fills most of this chamber. A blocked doorway stands on the far side.',
  { east: 9 });

// New town rooms (11–30)
ensureRoom(11, 'North Street',
  'A busy cobblestone street running north from the square. Shops and houses line both sides.',
  { south: 1, north: 14, east: 15, west: 16 });
ensureRoom(12, 'East Street',
  'The eastern street. You can hear the ring of a hammer from the smithy.',
  { west: 1, east: 17, north: 18 });
ensureRoom(13, 'West Street',
  'A quieter street. Laundry hangs between the buildings.',
  { east: 1, west: 19, south: 20 });
ensureRoom(14, 'Market Square',
  'A small open market. Stalls sell bread, cloth, and simple tools.',
  { south: 11, north: 21, east: 22 });
ensureRoom(15, 'Baker Street',
  'The smell of fresh bread is strong here. The bakery door stands open.',
  { west: 11, east: 23 });
ensureRoom(16, 'Residential Lane',
  'Narrow lane with modest wooden houses. A dog sleeps in a doorway.',
  { east: 11, west: 24, north: 25 });
ensureRoom(17, 'Smithy',
  'Heat rolls out of the open smithy. Tools hang on the walls and a sword lies on the anvil.',
  { west: 12 });
ensureRoom(18, 'Armorer Shop',
  'Racks of leather armor and a few metal pieces. The shopkeeper nods at you.',
  { south: 12 });
ensureRoom(19, 'General Store',
  'Shelves packed with rope, torches, rations, and odds and ends.',
  { east: 13 });
ensureRoom(20, 'Inn Yard',
  'The yard of the local inn. A stable stands to one side and the inn door is open.',
  { north: 13, east: 26 });
ensureRoom(21, 'North Gate Road',
  'The road leading to the north gate. Fields are visible beyond the wall.',
  { south: 14 });
ensureRoom(22, 'Clothier',
  'Bolts of cloth and simple cloaks. A mirror stands in the corner.',
  { west: 14 });
ensureRoom(23, 'Bakery',
  'Warm and bright. Loaves cool on the counter.',
  { west: 15 });
ensureRoom(24, 'Small House',
  'A modest one-room house. A table, a bed, and a chest.',
  { east: 16 });
ensureRoom(25, 'Herb Garden',
  'A tiny garden behind the houses. Herbs grow in neat rows.',
  { south: 16 });
ensureRoom(26, 'The Rusty Flagon Inn',
  'The common room of the inn. A fire burns in the hearth and a few locals sit at tables.',
  { west: 20, up: 27 });
ensureRoom(27, 'Inn Upstairs',
  'A short hallway with doors to guest rooms.',
  { down: 26, east: 28, west: 29 });
ensureRoom(28, 'Guest Room',
  'A simple room with a bed and a washbasin.',
  { west: 27 });
ensureRoom(29, 'Another Guest Room',
  'Nearly identical to the other guest room. A window looks over the yard.',
  { east: 27 });
ensureRoom(30, 'Town Well',
  'A stone well sits in a small plaza. Buckets and rope are nearby.',
  { south: 11, east: 1 });

// Seed items and creatures if needed
const itemCount = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
if (itemCount === 0) {
  db.prepare(`INSERT INTO items (name, description, room_id, location, wearable, container) VALUES (?, ?, ?, 'room', 0, 0)`).run(
    'rusty sword', 'A worn short sword with a few notches in the blade.', 1
  );
  db.prepare(`INSERT INTO items (name, description, room_id, location, wearable, container) VALUES (?, ?, ?, 'room', 1, 1)`).run(
    'leather backpack', 'A simple leather pack with room for a few items.', 1
  );
}
db.prepare(`UPDATE items SET wearable = 1, container = 1 WHERE lower(name) LIKE '%backpack%'`).run();
db.prepare(`UPDATE items SET wearable = 1 WHERE lower(name) LIKE '%shield%'`).run();

function ensureItem(name, description, roomId, wearable = 0, container = 0) {
  const exists = db.prepare('SELECT id FROM items WHERE lower(name) = ? AND room_id = ? AND location = "room"').get(name.toLowerCase(), roomId);
  if (!exists) {
    db.prepare(`INSERT INTO items (name, description, room_id, location, wearable, container) VALUES (?, ?, ?, 'room', ?, ?)`).run(
      name, description, roomId, wearable, container
    );
  }
}
ensureItem('old shield', 'A battered wooden shield.', 8, 1);
ensureItem('torch', 'A simple wooden torch.', 7);
ensureItem('loaf of bread', 'A fresh loaf of bread.', 23);
ensureItem('iron sword', 'A newly forged iron sword.', 17, 0);
ensureItem('leather armor', 'A set of boiled leather armor.', 18, 1);
ensureItem('rope', 'A coil of hemp rope.', 19);
ensureItem('tankard', 'A wooden tankard.', 26);

function ensureCreature(name, description, roomId, hp) {
  const exists = db.prepare('SELECT id FROM creatures WHERE name = ? AND room_id = ?').get(name, roomId);
  if (!exists) {
    db.prepare(`INSERT INTO creatures (name, description, room_id, hp, max_hp) VALUES (?, ?, ?, ?, ?)`).run(
      name, description, roomId, hp, hp
    );
  }
}
ensureCreature('giant rat', 'A large, mangy rat with yellow teeth.', 7, 12);
ensureCreature('skeleton', 'A humanoid skeleton with glowing eye sockets.', 8, 18);

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
  return db.prepare(`SELECT * FROM items WHERE room_id = ? AND location = 'room' AND container_id IS NULL`).all(roomId);
}

function getPlayerItems(playerId) {
  return db.prepare(`SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND container_id IS NULL`).all(playerId);
}

function getItemsInContainer(containerId) {
  return db.prepare(`SELECT * FROM items WHERE container_id = ?`).all(containerId);
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
        if ((player.max_hp || 0) < 40) {
          db.prepare('UPDATE players SET hp = 40, max_hp = 40 WHERE id = ?').run(player.id);
          player.hp = 40; player.max_hp = 40;
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
      const raw = (msg.text || '').trim();
      const input = raw.toLowerCase();
      const parts = input.split(/\s+/);
      const verb = parts[0];

      if (verb === 'look' || verb === 'l') {
        const rest = parts.slice(1).join(' ');
        if (rest.startsWith('in ')) {
          const contName = rest.slice(3).replace(/^my /, '');
          const container = db.prepare(
            `SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND container = 1 AND lower(name) LIKE ?`
          ).get(player.id, `%${contName}%`);
          if (!container) { send(ws, { type: 'text', text: 'You do not have that container.' }); return; }
          const inside = getItemsInContainer(container.id);
          send(ws, { type: 'text', text: inside.length ? `In the ${container.name}:\n` + inside.map(i => `  ${i.name}`).join('\n') : `The ${container.name} is empty.` });
        } else if (!rest) {
          send(ws, { type: 'text', text: describeRoom(getRoom(player.room_id)) });
        } else {
          const creature = db.prepare(`SELECT * FROM creatures WHERE room_id = ? AND hp > 0 AND lower(name) LIKE ?`).get(player.room_id, `%${rest}%`);
          send(ws, { type: 'text', text: creature ? `${creature.name}\n${creature.description}\nHP: ${creature.hp}/${creature.max_hp}` : 'You do not see that here.' });
        }
      }
      else if (verb === 'put') {
        const m = raw.match(/put\s+(.+?)\s+in\s+(?:my\s+)?(.+)/i);
        if (!m) { send(ws, { type: 'text', text: 'Put what in what?' }); return; }
        const item = db.prepare(`SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND container_id IS NULL AND lower(name) LIKE ?`).get(player.id, `%${m[1].toLowerCase()}%`);
        const container = db.prepare(`SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND container = 1 AND lower(name) LIKE ?`).get(player.id, `%${m[2].toLowerCase()}%`);
        if (!item || !container) { send(ws, { type: 'text', text: 'You cannot do that.' }); return; }
        db.prepare(`UPDATE items SET container_id = ? WHERE id = ?`).run(container.id, item.id);
        send(ws, { type: 'text', text: `You put the ${item.name} in the ${container.name}.` });
      }
      else if (verb === 'get' || verb === 'take') {
        const myMatch = raw.match(/(?:get|take)\s+my\s+(.+)/i);
        const fromMatch = raw.match(/(?:get|take)\s+(.+?)\s+from\s+(?:my\s+)?(.+)/i);
        if (myMatch) {
          const itemName = myMatch[1].toLowerCase();
          let item = db.prepare(`SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND container_id IS NULL AND lower(name) LIKE ?`).get(player.id, `%${itemName}%`);
          if (!item) {
            item = db.prepare(`SELECT items.* FROM items JOIN items AS c ON items.container_id = c.id WHERE c.player_id = ? AND lower(items.name) LIKE ?`).get(player.id, `%${itemName}%`);
            if (item) db.prepare(`UPDATE items SET container_id = NULL WHERE id = ?`).run(item.id);
          }
          send(ws, { type: 'text', text: item ? `You ready the ${item.name}.` : 'You are not carrying that.' });
        } else if (fromMatch) {
          const container = db.prepare(`SELECT * FROM items WHERE player_id = ? AND container = 1 AND lower(name) LIKE ?`).get(player.id, `%${fromMatch[2].toLowerCase()}%`);
          const item = container && db.prepare(`SELECT * FROM items WHERE container_id = ? AND lower(name) LIKE ?`).get(container.id, `%${fromMatch[1].toLowerCase()}%`);
          if (item) {
            db.prepare(`UPDATE items SET container_id = NULL WHERE id = ?`).run(item.id);
            send(ws, { type: 'text', text: `You get the ${item.name} from the ${container.name}.` });
          } else send(ws, { type: 'text', text: 'That is not in there.' });
        } else {
          const itemName = parts.slice(1).join(' ');
          const item = db.prepare(`SELECT * FROM items WHERE room_id = ? AND location = 'room' AND container_id IS NULL AND lower(name) LIKE ?`).get(player.room_id, `%${itemName}%`);
          if (item) {
            db.prepare(`UPDATE items SET room_id = NULL, player_id = ?, location = 'inventory', worn = 0 WHERE id = ?`).run(player.id, item.id);
            send(ws, { type: 'text', text: `You pick up the ${item.name}.` });
          } else send(ws, { type: 'text', text: 'You do not see that here.' });
        }
      }
      else if (verb === 'attack' || verb === 'kill') {
        const target = parts.slice(1).join(' ');
        const creature = db.prepare(`SELECT * FROM creatures WHERE room_id = ? AND hp > 0 AND lower(name) LIKE ?`).get(player.room_id, `%${target}%`);
        if (!creature) { send(ws, { type: 'text', text: 'You do not see that here.' }); return; }
        const dmg = Math.floor(Math.random() * 5) + 3;
        const newHp = creature.hp - dmg;
        let result = `You hit the ${creature.name} for ${dmg} damage.`;
        if (newHp <= 0) {
          db.prepare('UPDATE creatures SET hp = 0 WHERE id = ?').run(creature.id);
          result += `\nThe ${creature.name} dies!`;
        } else {
          db.prepare('UPDATE creatures SET hp = ? WHERE id = ?').run(newHp, creature.id);
          result += ` It has ${newHp} health left.`;
          const bite = Math.floor(Math.random() * 4) + 1;
          const p = db.prepare('SELECT hp FROM players WHERE id = ?').get(player.id);
          const php = Math.max(0, (p.hp || 40) - bite);
          db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(php, player.id);
          result += `\nThe ${creature.name} strikes you for ${bite}. You have ${php} health.`;
        }
        send(ws, { type: 'text', text: result });
      }
      else if (verb === 'rest') {
        const p = db.prepare('SELECT hp, max_hp FROM players WHERE id = ?').get(player.id);
        const healed = Math.min(p.max_hp, (p.hp || 0) + 10);
        db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(healed, player.id);
        send(ws, { type: 'text', text: `You rest. Health: ${healed}/${p.max_hp}` });
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
          send(ws, { type: 'text', text: `You go ${dir}.\n\n${describeRoom(getRoom(player.room_id))}` });
        } else send(ws, { type: 'text', text: 'You cannot go that way.' });
      }
      else if (verb === 'drop') {
        const itemName = parts.slice(1).join(' ');
        const item = db.prepare(`SELECT * FROM items WHERE player_id = ? AND location = 'inventory' AND container_id IS NULL AND lower(name) LIKE ?`).get(player.id, `%${itemName}%`);
        if (item) {
          db.prepare(`UPDATE items SET room_id = ?, player_id = NULL, location = 'room', worn = 0, container_id = NULL WHERE id = ?`).run(player.room_id, item.id);
          send(ws, { type: 'text', text: `You drop the ${item.name}.` });
        } else send(ws, { type: 'text', text: 'You are not carrying that.' });
      }
      else if (verb === 'wear') {
        const itemName = parts.slice(1).join(' ');
        const item = db.prepare(`SELECT * FROM items WHERE player_id = ? AND container_id IS NULL AND lower(name) LIKE ?`).get(player.id, `%${itemName}%`);
        if (item && item.wearable) {
          db.prepare(`UPDATE items SET worn = 1 WHERE id = ?`).run(item.id);
          send(ws, { type: 'text', text: `You wear the ${item.name}.` });
        } else send(ws, { type: 'text', text: 'You cannot wear that.' });
      }
      else if (verb === 'remove') {
        const itemName = parts.slice(1).join(' ');
        const item = db.prepare(`SELECT * FROM items WHERE player_id = ? AND worn = 1 AND lower(name) LIKE ?`).get(player.id, `%${itemName}%`);
        if (item) {
          db.prepare(`UPDATE items SET worn = 0 WHERE id = ?`).run(item.id);
          send(ws, { type: 'text', text: `You remove the ${item.name}.` });
        } else send(ws, { type: 'text', text: 'You are not wearing that.' });
      }
      else if (verb 
