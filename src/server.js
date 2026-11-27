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
  const row = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
  if (!row) {
    db.prepare('INSERT INTO rooms (id, name, description, exits) VALUES (?, ?, ?, ?)').run(id, name, description, JSON.stringify(exits));
  } else {
    db.prepare('UPDATE rooms SET name = ?, description = ?, exits = ? WHERE id = ?').run(name, description, JSON.stringify(exits), id);
  }
}

ensureRoom(1, 'Town Square', 'The heart of the town. Cobblestones, wooden buildings, smell of bread and woodsmoke.', {north:11, south:4, east:12, west:13});
ensureRoom(4, 'South Gate', 'Southern gate of the town. Path leads toward the hills.', {north:1, south:5, east:46});
ensureRoom(5, 'Hill Path', 'Grassy path up a low hill. Dark opening visible ahead.', {north:4, south:6});
ensureRoom(6, 'Dungeon Entrance', 'Rough stone arch into darkness. Cool damp air.', {north:5, down:7});
ensureRoom(7, 'Upper Corridor', 'Low torch-lit stone corridor.', {up:6, east:8, west:9});
ensureRoom(8, 'Guard Chamber', 'Abandoned guard room. Broken table, shield on the wall.', {west:7});
ensureRoom(9, 'West Passage', 'Narrow dripping passage.', {east:7, west:10});
ensureRoom(10, 'Collapsed Room', 'Ceiling has fallen. Rubble everywhere. Far doorway blocked.', {east:9});
ensureRoom(11, 'North Street', 'Main northern street. Shops and houses on both sides.', {south:1, north:14, east:15, west:16});
ensureRoom(12, 'East Street', 'Eastern street. Hammering from the smithy.', {west:1, east:17, north:18, south:31});
ensureRoom(13, 'West Street', 'Quieter western street. Laundry lines overhead.', {east:1, west:19, south:20, north:32});
ensureRoom(14, 'Market Square', 'Open market with wooden stalls.', {south:11, north:21, east:22, west:33});
ensureRoom(15, 'Baker Street', 'Street of bakers. Warm bread smell.', {west:11, east:23, north:34});
ensureRoom(16, 'Residential Lane', 'Modest wooden houses.', {east:11, west:24, north:25, south:35});
ensureRoom(17, 'Smithy', 'Hot, noisy smithy. Tools and a sword on the anvil.', {west:12});
ensureRoom(18, 'Armorer', 'Leather and metal armor on racks.', {south:12});
ensureRoom(19, 'General Store', 'Packed shelves of everyday goods.', {east:13});
ensureRoom(20, 'Inn Yard', 'Courtyard of the Rusty Flagon. Stable nearby.', {north:13, east:26, south:36});
ensureRoom(21, 'North Gate Road', 'Road to the north gate.', {south:14, north:37});
ensureRoom(22, 'Clothier', 'Bolts of cloth and hanging cloaks.', {west:14});
ensureRoom(23, 'Bakery', 'Warm bakery, loaves on the counter.', {west:15});
ensureRoom(24, 'Small House', 'Simple one-room home.', {east:16});
ensureRoom(25, 'Herb Garden', 'Neat rows of herbs.', {south:16, north:38});
ensureRoom(26, 'Rusty Flagon Common Room', 'Inn common room. Fire, tables, locals.', {west:20, up:27});
ensureRoom(27, 'Inn Upstairs Hall', 'Upstairs hallway of the inn.', {down:26, east:28, west:29});
ensureRoom(28, 'Guest Room East', 'Plain guest room.', {west:27});
ensureRoom(29, 'Guest Room West', 'Another plain guest room.', {east:27});
ensureRoom(30, 'Town Well', 'Stone well in a small plaza.', {south:11, west:1});
ensureRoom(31, 'East Alley', 'Crates and barrels behind the shops.', {north:12, south:39});
ensureRoom(32, 'West Alley', 'Shadowy alley. A stray dog sometimes sleeps here.', {south:13, west:40});
ensureRoom(33, 'Market Stalls', 'Row of market stalls.', {east:14});
ensureRoom(34, 'Mill Road', 'Road toward the old mill.', {south:15, north:41});
ensureRoom(35, 'Back Lane', 'Quiet lane behind the houses.', {north:16, east:42});
ensureRoom(36, 'Stable', 'Hay and empty horse stalls.', {north:20});
ensureRoom(37, 'North Gate', 'Northern town gate.', {south:21, north:43});
ensureRoom(38, 'Chapel Garden', 'Small garden beside the chapel.', {south:25, east:44});
ensureRoom(39, 'Warehouse', 'Dim warehouse full of crates.', {north:31});
ensureRoom(40, 'Tanner Yard', 'Hides hanging on racks.', {east:32});
ensureRoom(41, 'Old Mill', 'Abandoned mill. Wheel is still.', {south:34});
ensureRoom(42, 'Potter', 'Clay pots and a kiln.', {west:35});
ensureRoom(43, 'North Fields', 'Dirt path through the fields.', {south:37});
ensureRoom(44, 'Chapel', 'Small stone chapel with wooden pews.', {west:38, south:45});
ensureRoom(45, 'Chapel Basement', 'Cool storage under the chapel.', {north:44});
ensureRoom(46, 'South Guard Post', 'Small guard post by the south gate.', {west:4, east:47});
ensureRoom(47, 'Barracks', 'Simple barracks with bunks and racks.', {west:46});
ensureRoom(48, 'Mayor\'s House', 'Largest house in town.', {south:14, north:49});
ensureRoom(49, 'Mayor\'s Study', 'Wood-paneled study with maps.', {south:48});
ensureRoom(50, 'South Fields Path', 'Path leaving town to the south fields.', {north:4});

function ensureItem(name, desc, roomId, wearable = 0, container = 0) {
  const e = db.prepare('SELECT id FROM items WHERE lower(name) = ? AND room_id = ? AND location = "room"').get(name.toLowerCase(), roomId);
  if (!e) db.prepare('INSERT INTO items (name, description, room_id, location, wearable, container) VALUES (?, ?, ?, "room", ?, ?)').run(name, desc, roomId, wearable, container);
}
ensureItem('rusty sword', 'A worn short sword.', 1);
ensureItem('leather backpack', 'A simple pack.', 1, 1, 1);
ensureItem('old shield', 'Battered wooden shield.', 8, 1);
ensureItem('torch', 'Wooden torch.', 7);
ensureItem('loaf of bread', 'Fresh bread.', 23);
ensureItem('iron sword', 'Newly forged sword.', 17);
ensureItem('leather armor', 'Boiled leather armor.', 18, 1);
ensureItem('rope', 'Coil of rope.', 19);
ensureItem('tankard', 'Wooden tankard.', 26);
ensureItem('dried meat', 'Strips of dried meat.', 33);
ensureItem('clay pot', 'Simple clay pot.', 42);
ensureItem('prayer book', 'Worn prayer book.', 44);

function ensureCreature(name, desc, roomId, hp) {
  const e = db.prepare('SELECT id FROM creatures WHERE name = ? AND room_id = ?').get(name, roomId);
  if (!e) db.prepare('INSERT INTO creatures (name, description, room_id, hp, max_hp) VALUES (?, ?, ?, ?, ?)').run(name, desc, roomId, hp, hp);
}
ensureCreature('giant rat', 'Large mangy rat with yellow teeth.', 7, 12);
ensureCreature('skeleton', 'Skeleton with faintly glowing eyes.', 8, 18);
ensureCreature('stray dog', 'Thin stray dog.', 32, 8);

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

function send(ws, o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }
function getRoom(id) { return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id); }
function itemsInRoom(rid) { return db.prepare('SELECT * FROM items WHERE room_id = ? AND location = "room" AND container_id IS NULL').all(rid); }
function playerItems(pid) { return db.prepare('SELECT * FROM items WHERE player_id = ? AND location = "inventory" AND container_id IS NULL').all(pid); }
function itemsInContainer(cid) { return db.prepare('SELECT * FROM items WHERE container_id = ?').all(cid); }

function describeRoom(room) {
  if (!room) return 'You are nowhere.';
  const exits = Object.keys(JSON.parse(room.exits || '{}')).join(', ') || 'none';
  const items = itemsInRoom(room.id);
  const creats = db.prepare('SELECT name FROM creatures WHERE room_id = ? AND hp > 0').all(room.id);
  let t = `${room.name}\n${room.description}\nObvious exits: ${exits}`;
  if (items.length) t += '\nYou also see: ' + items.map(i => i.name).join(', ');
  if (creats.length) t += '\nCreatures here: ' + creats.map(c => c.name).join(', ');
  return t;
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'login') {
      const name = (msg.name || 'Traveler').trim().slice(0, 20);
      let p = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
      if (!p) {
        db.prepare('INSERT INTO players (name, room_id, hp, max_hp) VALUES (?, 1, 40, 40)').run(name);
        p = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
        send(ws, { type: 'text', text: `Welcome, ${name}.` });
      } else {
        if ((p.max_hp || 0) < 40) db.prepare('UPDATE players SET hp = 40, max_hp = 40 WHERE id = ?').run(p.id);
        send(ws, { type: 'text', text: `Welcome back, ${name}.` });
      }
      clients.set(ws, p);
      send(ws, { type: 'text', text: describeRoom(getRoom(p.room_id)) });
      return;
    }
    const player = clients.get(ws);
    if (!player || msg.type !== 'command') return;
    const rawCmd = (msg.text || '').trim();
    const lower = rawCmd.toLowerCase();
    const parts = lower.split(/\s+/);
    const verb = parts[0];

    if (verb === 'look' || verb === 'l') {
      const rest = parts.slice(1).join(' ');
      if (rest.startsWith('in ')) {
        const cn = rest.slice(3).replace(/^my /, '');
        const c = db.prepare('SELECT * FROM items WHERE player_id = ? AND container = 1 AND lower(name) LIKE ?').get(player.id, `%${cn}%`);
        if (!c) return send(ws, { type: 'text', text: 'You do not have that container.' });
        const inside = itemsInContainer(c.id);
        send(ws, { type: 'text', text: inside.length ? `The ${c.name} contains:\n` + inside.map(i => '  ' + i.name).join('\n') : `The ${c.name} is empty.` });
      } else if (!rest) {
        send(ws, { type: 'text', text: describeRoom(getRoom(player.room_id)) });
      } else {
        const cr = db.prepare('SELECT * FROM creatures WHERE room_id = ? AND hp > 0 AND lower(name) LIKE ?').get(player.room_id, `%${rest}%`);
        send(ws, { type: 'text', text: cr ? `${cr.name}\n${cr.description}\nHealth: ${cr.hp}/${cr.max_hp}` : 'You do not see that here.' });
      }
    }
    else if (verb === 'put') {
      const m = rawCmd.match(/put\s+(.+?)\s+in\s+(?:my\s+)?(.+)/i);
      if (!m) return send(ws, { type: 'text', text: 'Put what in what?' });
      const item = db.prepare('SELECT * FROM items WHERE player_id = ? AND container_id IS NULL AND lower(name) LIKE ?').get(player.id, `%${m[1].toLowerCase()}%`);
      const cont = db.prepare('SELECT * FROM items WHERE player_id = ? AND container = 1 AND lower(name) LIKE ?').get(player.id, `%${m[2].toLowerCase()}%`);
      if (!item || !cont) return send(ws, { type: 'text', text: 'You cannot do that.' });
      db.prepare('UPDATE items SET container_id = ? WHERE id = ?').run(cont.id, item.id);
      send(ws, { type: 'text', text: `You put the ${item.name} in the ${cont.name}.` });
    }
    else if (verb === 'get' || verb === 'take') {
      const myM = rawCmd.match(/(?:get|take)\s+my\s+(.+)/i);
      const fromM = rawCmd.match(/(?:get|take)\s+(.+?)\s+from\s+(?:my\s+)?(.+)/i);
      if (myM) {
        let item = db.prepare('SELECT * FROM items WHERE player_id = ? AND container_id IS NULL AND lower(name) LIKE ?').get(player.id, `%${myM[1].toLowerCase()}%`);
        if (!item) {
          item = db.prepare('SELECT items.* FROM items JOIN items c ON items.container_id = c.id WHERE c.player_id = ? AND lower(items.name) LIKE ?').get(player.id, `%${myM[1].toLowerCase()}%`);
          if (item) db.prepare('UPDATE items SET container_id = NULL WHERE id = ?').run(item.id);
        }
        send(ws, { type: 'text', text: item ? `You get your ${item.name}.` : 'You do not have that.' });
      } else if (fromM) {
        const cont = db.prepare('SELECT * FROM items WHERE player_id = ? AND container = 1 AND lower(name) LIKE ?').get(player.id, `%${fromM[2].toLowerCase()}%`);
        const item = cont && db.prepare('SELECT * FROM items WHERE container_id = ? AND lower(name) LIKE ?').get(cont.id, `%${fromM[1].toLowerCase()}%`);
        if (item) {
          db.prepare('UPDATE items SET container_id = NULL WHERE id = ?').run(item.id);
          send(ws, { type: 'text', text: `You get the ${item.name} from the ${cont.name}.` });
        } else send(ws, { type: 'text', text: 'That is not in there.' });
      } else {
        const n = parts.slice(1).join(' ');
        const item = db.prepare('SELECT * FROM items WHERE room_id = ? AND location = "room" AND container_id IS NULL AND lower(name) LIKE ?').get(player.room_id, `%${n}%`);
        if (item) {
          db.prepare('UPDATE items SET room_id = NULL, player_id = ?, location = "inventory", worn = 0 WHERE id = ?').run(player.id, item.id);
          send(ws, { type: 'text', text: `You pick up the ${item.name}.` });
        } else send(ws, { type: 'text', text: 'You do not see that here.' });
      }
    }
    else if (verb === 'attack' || verb === 'kill') {
      const t = parts.slice(1).join(' ');
      const cr = db.prepare('SELECT * FROM creatures WHERE room_id = ? AND hp > 0 AND lower(name) LIKE ?').get(player.room_id, `%${t}%`);
      if (!cr) return send(ws, { type: 'text', text: 'Nothing like that here.' });
      const dmg = 3 + Math.floor(Math.random() * 5);
      const nh = cr.hp - dmg;
      let msgt = `You strike the ${cr.name} for ${dmg} damage.`;
      if (nh <= 0) {
        db.prepare('UPDATE creatures SET hp = 0 WHERE id = ?').run(cr.id);
        msgt += `\nThe ${cr.name} collapses and dies.`;
      } else {
        db.prepare('UPDATE creatures SET hp = ? WHERE id = ?').run(nh, cr.id);
        msgt += ` It has ${nh} health remaining.`;
        const bite = 1 + Math.floor(Math.random() * 4);
        const p = db.prepare('SELECT hp FROM players WHERE id = ?').get(player.id);
        const php = Math.max(0, (p.hp || 40) - bite);
        db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(php, player.id);
        msgt += `\nThe ${cr.name} hits you for ${bite}. You have ${php} health.`;
      }
      send(ws, { type: 'text', text: msgt });
    }
    else if (verb === 'rest') {
      const p = db.prepare('SELECT hp, max_hp FROM players WHERE id = ?').get(player.id);
      const h = Math.min(p.max_hp, (p.hp || 0) + 12);
      db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(h, player.id);
      send(ws, { type: 'text', text: `You rest and recover. Health: ${h}/${p.max_hp}` });
    }
    else if (verb === 'go' || ['n','north','s','south','e','east','w','west','u','up','d','down'].includes(verb)) {
      let dir = (verb === 'go' ? parts[1] : verb);
      const map = {n:'north', s:'south', e:'east', w:'west', u:'up', d:'down'};
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
      const n = parts.slice(1).join(' ');
      const item = db.prepare('SELECT * FROM items WHERE player_id = ? AND container_id IS NULL AND lower(name) LIKE ?').get(player.id, `%${n}%`);
      if (item) {
        db.prepare('UPDATE items SET room_id = ?, player_id = NULL, location = "room", worn = 0, container_id = NULL WHERE id = ?').run(player.room_id, item.id);
        send(ws, { type: 'text', text: `You drop the ${item.name}.` });
      } else send(ws, { type: 'text', text: 'You are not carrying that.' });
    }
    else if (verb === 'wear') {
      const n = parts.slice(1).join(' ');
      const item = db.prepare('SELECT * FROM items WHERE player_id = ? AND container_id IS NULL AND lower(name) LIKE ?').get(player.id, `%${n}%`);
      if (item && item.wearable) {
        db.prepare('UPDATE items SET worn = 1 WHERE id = ?').run(item.id);
        send(ws, { type: 'text', text: `You wear the ${item.name}.` });
      } else send(ws, { type: 'text', text: 'You cannot wear that.' });
    }
    else if (verb === 'remove') {
      const n = parts.slice(1).join(' ');
      const item = db.prepare('SELECT * FROM items WHERE player_id = ? AND worn = 1 AND lower(name) LIKE ?').get(player.id, `%${n}%`);
      if (item) {
        db.prepare('UPDATE items SET worn = 0 WHERE id = ?').run(item.id);
        send(ws, { type: 'text', text: `You remove the ${item.name}.` });
      } else send(ws, { type: 'text', text: 'You are not wearing that.' });
    }
    else if (['i','inv','inventory'].includes(verb)) {
      const items = playerItems(player.id);
      send(ws, { type: 'text', text: items.length ? 'You are carrying:\n' + items.map(i => `  ${i.name}${i.worn ? ' (worn)' : ''}`).join('\n') : 'You are not carrying anything.' });
    }
    else if (verb === 'health' || verb === 'hp') {
      const p = db.prepare('SELECT hp, max_hp FROM players WHERE id = ?').get(player.id);
      send(ws, { type: 'text', text: `Health: ${p.hp}/${p.max_hp}` });
    }
    else {
      send(ws, { type: 'text', text: 'Commands: look, get, get my, put X in Y, attack, rest, go, inventory, health' });
    }
  });
  ws.on('close', () => clients.delete(ws));
});

server.listen(8080, '0.0.0.0', () => console.log('Gem Stones listening on 8080'));
