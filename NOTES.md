time:
---- actions ---- reveal ---- actions
S0 S1 S2

S0 is determined when the dungeon start
S(n+1) = S(n) + ACTION_PERIOD
S(n+2) = S(n) + ACTION_PERIOD + REVEAL_PERIOD

Aiming:
ACTION_PERIOD = 23h
REVEAL_PERIOD = 1h

TOTAL = 24h

epoch = Math.floor((timestamp - startTimestamp) / TOTAL);
isActionPeriod = (timestamp - (epoch \* TOTAL)) < ACTION_PERIOD;
isRevealPeriod = !isActionPeriod;

dungeonHash = keccak256("autonomous-dungeon", epoch); // for now

roomHash = keccak256(dungeonHash, coords);
roomDoors = roomHash[0:4]
roomLocks = roomHash[5:8]
roomChest = roomHash[9:12]
roomMonster = roomHash[13:16]

draw

from renderX/renderY we get the top left world pos
we then fetch character up to renderWidth/renderHeight (converted in visualWorld width/height)

visualWorld is 3x3
blockchain world is 1x1
