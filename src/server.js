const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '../data/game.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY, name TEXT, description TEXT, exits TEXT
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY, name TEXT UNIQUE, room_id INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 40, max_hp INTEGER DEFAULT 40
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY, name TEXT, description TEXT,
    room_id INTEGER, player_id INTEGER, location TEXT DEFAULT 'room',
    wearable INTEGER DEFAULT 0, worn INTEGER DEFAULT 0,
    container INTEGER DEFAULT 0, container_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS creatures (
    id INTEGER PRIMARY KEY, name TEXT, description TEXT,
    room_id INTEGER, hp INTEGER DEFAULT 10, max_hp INTEGER DEFAULT 10
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
    db.prepare('INSERT INTO rooms (id, name, description, exits) VALUES (?, ?, ?, ?)').run(id, name, description, JSON.stringify(exits));
  } else {
    db.prepare('UPDATE rooms SET name = ?, description = ?, exits = ? WHERE id = ?').run(name, description, JSON.stringify(exits), id);
  }
}

ensureRoom(1, 'Town Square', 'Cobblestone square at the heart of town. Smoke and bread smells drift on the air.', { north: 11, south: 4, east: 12, west: 13 });
ensureRoom(4, 'South Gate', 'The southern gate stands open. A path leads toward the hills.', { north: 1, south: 5 });
ensureRoom(5, 'Hill Path', 'A grassy path climbs toward a dark opening in the rock.', { north: 4, south: 6 });
ensureRoom(6, 'Dungeon Entrance', 'Stone archway into darkness. Cool air drifts out.', { north: 5, down: 7 });
ensureRoom(7, 'Upper Corridor', 'Low stone corridor lit by torches.', { up: 6, east: 8, west: 9 });
ensureRoom(8, 'Guard Chamber', 'Old guard room with broken furniture.', { west: 7 });
ensureRoom(9, 'West Passage', 'Narrow passage. Water drips somewhere ahead.', { east: 7, west: 10 });
ensureRoom(10, 'Collapsed Room', 'Rubble-filled chamber. A doorway is blocked by stone.', { east: 9 });

ensureRoom(11, 'North Street', 'Busy cobblestone street. Shops and houses line both sides.', { south: 1, north: 14, east: 15, west: 16 });
ensureRoom(12, 'East Street', 'Eastern street. The ring of a hammer comes from the smithy.', { west: 1, east: 17, north: 18, south: 31 });
ensureRoom(13, 'West Street', 'Quieter street. Laundry hangs between buildings.', { east: 1, west: 19, south: 20, north: 32 });
ensureRoom(14, 'Market Square', 'Small open market with stalls of bread, cloth, and tools.', { south: 11, north: 21, east: 22, west: 33 });
ensureRoom(15, 'Baker Street', 'The smell of fresh bread is strong. Bakery door is open.', { west: 11, east: 23, north: 34 });
ensureRoom(16, 'Residential Lane', 'Narrow lane of modest wooden houses.', { east: 11, west: 24, north: 25, south: 35 });
ensureRoom(17, 'Smithy', 'Hot smithy. Tools on the walls, sword on the anvil.', { west: 12 });
ensureRoom(18, 'Armorer Shop', 'Racks of leather and a few metal pieces.', { south: 12 });
ensureRoom(19, 'General Store', 'Shelves of rope, torches, rations, and odds and ends.', { east: 13 });
ensureRoom(20, 'Inn Yard', 'Yard of the local inn. Stable to one side.', { north: 13, east: 26, south: 36 });
ensureRoom(21, 'North Gate Road', 'Road to the north gate. Fields beyond the wall.', { south: 14, north: 37 });
ensureRoom(22, 'Clothier', 'Bolts of cloth and simple cloaks.', { west: 14 });
ensureRoom(23, 'Bakery', 'Warm bakery. Loaves cooling on the counter.', { west: 15 });
ensureRoom(24, 'Small House', 'Modest one-room house with table, bed, and chest.', { east: 16 });
ensureRoom(25, 'Herb Garden', 'Tiny garden with neat rows of herbs.', { south: 16, north: 38 });
ensureRoom(26, 'The Rusty Flagon Inn', 'Common room. Fire in the hearth, locals at tables.', { west: 20, up: 27 });
ensureRoom(27, 'Inn Upstairs', 'Hallway with doors to guest rooms.', { down: 26, east: 28, west: 29 });
ensureRoom(28, 'Guest Room', 'Simple room with bed and washbasin.', { west: 27 });
ensureRoom(29, 'Another Guest Room', 'Window looks over the inn yard.', { east: 27 });
ensureRoom(30, 'Town Well', 'Stone well in a small plaza.', { south: 11, west: 1 });

// New rooms 31-48
ensureRoom(31, 'East Alley', 'Narrow alley behind the east street shops. Crates and barrels.', { north: 12, south: 39 });
ensureRoom(32, 'West Alley', 'Shadowy alley. A cat watches from a fence.', { south: 13, west: 40 });
ensureRoom(33, 'Market Stall Row', 'Row of wooden stalls. One sells dried meat.', { east: 14 });
ensureRoom(34, 'Mill Road', 'Road leading toward a small mill outside the walls.', { south: 15, north: 41 });
ensureRoom(35, 'Back Lane', 'Quiet back lane between houses.', { north: 16, east: 42 });
ensureRoom(36, 'Stable', 'Smell of hay and horses. A few stalls, most empty.', { north: 20 });
ensureRoom(37, 'North Gate', 'The northern gate. Guards occasionally pass through.', { south: 21, north: 43 });
ensureRoom(38, 'Chapel Garden', 'Small garden beside the town chapel.', { south: 25, east: 44 });
ensureRoom(39, 'Warehouse', 'Dim warehouse full of crates and sacks.', { north: 31 });
ensureRoom(40, 'Tanner Yard', 'Yard behind the tanner. Hides hang on racks.', { east: 32 });
ensureRoom(41, 'Old Mill', 'Abandoned mill. The wheel no longer turns.', { south: 34 });
ensureRoom(42, 'Potter Shop', 'Clay pots and jars on shelves. Kiln in the back.', { west: 35 });
ensureRoom(43, 'North Fields Path', 'Dirt path through the fields north of town.', { south: 37 });
ensureRoom(44, 'Chapel', 'Small stone chapel. Wooden pews and a simple altar.', { west: 38, south: 45 });
ensureRoom(45, 'Chapel Basement', 'Cool basement under the chapel. Old stores and a locked door.', { north: 44 });
ensureRoom(46, 'Guard Post', 'Small guard post near the south gate.', { north: 4, east: 47 });
ensureRoom(47, 'Barracks', 'Simple barracks. Bunks and weapon racks.', { west: 46 });
ensureRoom(48, 'Mayor House', 'The largest house in town. Well-kept garden in front.', { south: 14, north: 49 });
ensureRoom(49, 'Mayor Study', 'Wood-paneled study. Maps on the wall.', { south: 48 });

function ensureItem(name, desc, roomId, wearable=0, container=0) {
  const e = db.prepare('SELECT id FROM items WHERE lower(name)=? AND room_id=? AND location="room"').get(name.toLowerCase(), roomId);
  if (!e) db.prepare('INSERT INTO items (name, description, room_id, location, wearable, container) VALUES (?,?,?,"room",?,?)').run(name, desc, roomId, wearable, container);
}
ensureItem('rusty sword', 'A worn short sword.', 1);
ensureItem('leather backpack', 'A simple leather pack.', 1, 1, 1);
ensureItem('old shield', 'A battered wooden shield.', 8, 1);
ensureItem('torch', 'A wooden torch.', 7);
ensureItem('loaf of bread', 'Fresh bread.', 23);
ensureItem('iron sword', 'A newly forged sword.', 17);
ensureItem('leather armor', 'Boiled leather armor.', 18, 1);
ensureItem('rope', 'A coil of rope.', 19);
ensureItem('tankard', 'A wooden tankard.', 26);
ensureItem('dried meat', 'Strips of dried meat.', 33);
ensureItem('clay pot', 'A simple clay pot.', 42);
ensureItem('prayer book', 'A worn prayer book.', 44);

function ensureCreature(name, desc, roomId, hp) {
  const e = db.prepare('SELECT id FROM creatures WHERE name=? AND room_id=?').get(name, roomId);
  if (!e) db.prepare('INSERT INTO creatures (name, description, room_id, hp, max_hp) VALUES (?,?,?,?,?)').run(name, desc, roomId, hp, hp);
}
ensureCreature('giant rat', 'A large mangy rat.', 7, 12);
ensureCreature('skeleton', 'A skeleton with glowing eyes.', 8, 18);
ensureCreature('stray dog', 'A thin stray dog. It growls half-heartedly.', 32, 8);

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(fs.readFileSync(path.join(__dirname, '../public/index.html')));
  } else { res.writeHead(404); res.end('Not found'); }
});

const wss = new WebSocket.Server({ server });
const clients = new Map();

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function getRoom(id) { return db.prepare('SELECT * FROM rooms WHERE id=?').get(id); }
function getItemsInRoom(rid) { return db.prepare('SELECT * FROM items WHERE room_id=? AND location="room" AND container_id IS NULL').all(rid); }
function getPlayerItems(pid) { return db.prepare('SELECT * FROM items WHERE player_id=? AND location="inventory" AND container_id IS NULL').all(pid); }
function getItemsInContainer(cid) { return db.prepare('SELECT * FROM items WHERE container_id=?').all(cid); }

function describeRoom(room) {
  const exits = JSON.parse(room.exits || '{}');
  const exitList = Object.keys(exits).join(', ') || 'none';
  const items = getItemsInRoom(room.id);
  const creatures = db.prepare('SELECT * FROM creatures WHERE room_id=? AND hp>0').all(room.id);
  let extra = '';
  if (items.length) extra += '\nYou also see: ' + items.map(i=>i.name).join(', ');
  if (creatures.length) extra += '\nCreatures here: ' + creatures.map(c=>c.name).join(', ');
  return `${room.name}\n${room.description}\nObvious exits: ${exitList}${extra}`;
}

wss.on('connection', ws => {
  ws.on('message', data => {
    let msg; try { msg = JSON.parse(data); } catch { return; }
    if (msg.type === 'login') {
      const name = (msg.name || 'Traveler').trim().slice(0,20);
      let player = db.prepare('SELECT * FROM players WHERE name=?').get(name);
      if (!player) {
        db.prepare('INSERT INTO players (name, room_id, hp, max_hp) VALUES (?,1,40,40)').run(name);
        player = db.prepare('SELECT * FROM players WHERE name=?').get(name);
        send(ws, {type:'text', text:`Welcome, ${name}.`});
      } else {
        if ((player.max_hp||0) < 40) db.prepare('UPDATE players SET hp=40, max_hp=40 WHERE id=?').run(player.id);
        send(ws, {type:'text', text:`Welcome back, ${name}.`});
      }
      clients.set(ws, player);
      send(ws, {type:'text', text: describeRoom(getRoom(player.room_id))});
      return;
    }
    const player = clients.get(ws);
    if (!player) return;
    if (msg.type === 'command') {
      const raw = (msg.text||'').trim();
      const input = raw.toLowerCase();
      const parts = input.split(/\s+/);
      const verb = parts[0];

      if (verb === 'look' || verb === 'l') {
        const rest = parts.slice(1).join(' ');
        if (rest.startsWith('in ')) {
          const cn = rest.slice(3).replace(/^my /,'');
          const c = db.prepare('SELECT * FROM items WHERE player_id=? AND container=1 AND lower(name) LIKE ?').get(player.id, `%${cn}%`);
          if (!c) return send(ws, {type:'text', text:'You do not have that.'});
          const inside = getItemsInContainer(c.id);
          send(ws, {type:'text', text: inside.length ? `In the ${c.name}:\n`+inside.map(i=>'  '+i.name).join('\n') : `The ${c.name} is empty.`});
        } else if (!rest) {
          send(ws, {type:'text', text: describeRoom(getRoom(player.room_id))});
