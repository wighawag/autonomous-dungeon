// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "forge-deploy-proxy/ForgeDeploy_Proxied.sol";
import "forge-std/console.sol";

import "./Extraction.sol";
import "./Characters.sol";
import "./UsingInternalTimestamp.sol";

contract Dungeon is Proxied, UsingInternalTimestamp {
    // ----------------------------------------------------------------------------------------------
    // CONSTANTS
    // ----------------------------------------------------------------------------------------------

    uint256 constant TOTAL = 24 * 3600;
    uint256 constant ACTION_PERIOD = 23 * 3600;
    uint256 constant START_TIMESTAMP = 0;

    // ----------------------------------------------------------------------------------------------
    // EVENTS
    // ----------------------------------------------------------------------------------------------
    event CommitmentMade(uint256 indexed characterID, uint32 indexed epoch, bytes24 commitmentHash);
    event CommitmentVoid(uint256 indexed characterID, uint32 indexed epoch);
    event CommitmentResolved(
        uint256 indexed characterID,
        uint32 indexed epoch,
        bytes24 indexed commitmentHash,
        Action[] actions,
        bytes24 furtherActions
    );

    event CharacterUpdate(
        uint256 indexed characterID,
        uint256 indexed position,
        uint8 life,
        uint256 gold,
        bytes32 equipment,
        uint16 combatStanceAvailable
    );
    event RoomUpdate(uint256 indexed position, bytes32 goldBattle, bytes32 monsterBattle);
    event EpochHashUpdate(uint256 indexed epoch, bytes32 epochHash);
    event CharacterEnterTheDungeon(address indexed player, uint256 indexed characterID);
    event MonsterClaim(uint256 indexed characterID, uint256 indexed position, uint256 indexed epoch);
    event MonsterDefeat(uint256 indexed position, uint256 indexed epoch);

    // ----------------------------------------------------------------------------------------------
    // STORAGE TYPES
    // ----------------------------------------------------------------------------------------------

    struct Character {
        uint256 position;
        uint256 gold;
        // TODO xp
        uint8 life;
        bytes32 equipment;
        uint16 combatStanceAvailable;
    }

    // struct RoomStatus {
    //     bytes32 goldBattle; // this represent a battle against other character with gold given to winner
    //     bytes32 monsterBattle; // this represent a battle against a monster with loot shared (based on success? // or same/similar like goldBattle)
    // }

    struct GoldBattle {
        uint256 currentWinner;
        uint16 combatStance;
    }

    struct MonsterBattle {
        uint256 life; // when max uint player have the drop, but it is only given onchain on next epoch reveal (it is always given, event on death)
    }

    struct Commitment {
        bytes24 hash;
        uint32 epoch;
    }

    // ----------------------------------------------------------------------------------------------
    // MEMORY ONLY TYPES
    // ----------------------------------------------------------------------------------------------

    // this only track what changes
    // when life is zero,
    // gold and equiipment are considered taken
    // uint256 gold;
    // bytes32 equipment;

    struct Monster {
        uint8 life;
        uint16 combatStance;
    }

    struct Action {
        uint256 position; // TODO uint64
        bool pickTreasure;
    }

    struct Room {
        bool[4] exits;
        bool treasure;
        bool monster;
    }

    // ----------------------------------------------------------------------------------------------
    // STORAGE
    // ----------------------------------------------------------------------------------------------

    mapping(uint256 => mapping(uint256 => GoldBattle)) public goldBattles; // we use epoch to ensure not reading from last // TODO optimize by keeping track of epoch used instead of mapping
    mapping(uint256 => mapping(uint256 => MonsterBattle)) public monsterBattles; // per epoch, so player can claim later: TODO document the 2 and half phase system
    mapping(uint256 => uint256) public monsterClaims;
    mapping(uint256 => Character) public characters;
    mapping(uint256 => address) public owners;
    mapping(uint256 => Commitment) public commitments;

    bytes32 internal epochHash_0;
    bytes32 internal epochHash_1;

    // TODO
    // bytes32 internal layer2_epochHash_0;
    // bytes32 internal layer2_epochHash_1;

    Characters immutable characterTokens;

    // ----------------------------------------------------------------------------------------------
    // CONSTRUCTOR / INITIALIZER
    // ----------------------------------------------------------------------------------------------

    constructor(Characters charactersCollection) {
        characterTokens = charactersCollection;
        postUpgrade(charactersCollection);
    }

    function postUpgrade(Characters charactersCollection) public proxied {
        if (charactersCollection != characterTokens) {
            revert("characterTokens is immutable");
        }

        // TODO with forge-deploy-proxy this is not called
        (uint32 epoch, bool commiting) = _epoch();
        // this is the first event, signaling to the indexer the first hash and epoch
        _handleEpochHash(commiting ? epoch - 1 : epoch, bytes32(0));
    }

    // ----------------------------------------------------------------------------------------------
    // PUBLIC INTERFACE
    // ----------------------------------------------------------------------------------------------

    function enter() external payable {
        require(msg.value == 1000000000000000, "GIVE ME THE KWEI");
        // for now we just associate character with wallet
        // TODO
        // TODO leaving
        uint256 characterID = uint256(uint160(msg.sender));
        require(owners[characterID] == address(0), "ALREADY_IN");
        characterTokens.mint(characterID, address(this));
        owners[characterID] = msg.sender;
        emit CharacterEnterTheDungeon(msg.sender, characterID);

        _handleCharacter(
            characterID, Character({position: 0, life: 3, gold: 0, equipment: bytes32(0), combatStanceAvailable: 511})
        );
    }

    function makeCommitment(uint256 characterID, bytes24 commitmentHash) external {
        require(owners[characterID] == msg.sender, "NOT_OWNER");
        Character memory character = characters[characterID];
        require(character.life > 0, "DEAD");
        _makeCommitment(characterID, commitmentHash);
    }

    function resolve(
        uint256 characterID,
        bytes32 secret,
        Action[] calldata actions,
        uint16 combatStance,
        bytes24 furtherActions
    ) external {
        Commitment storage commitment = commitments[characterID];
        (uint32 epoch, bool commiting) = _epoch();

        require(!commiting, "IN_COMMITING_PHASE");
        require(commitment.epoch != 0, "NOTHING_TO_RESOLVE");
        require(commitment.epoch == epoch, "INVALID_epoch");

        _checkHash(commitment.hash, secret, actions, combatStance, furtherActions);

        // we emit that first to signal, any new state is now computed for the new epoch
        // if we do after other events, then the event will not be first and its last occurence would not be able to indicate the end
        _handleEpochHash(epoch, secret);

        Character memory character = characters[characterID];

        require(
            // TODO count the number of bit too
            combatStance | character.combatStanceAvailable == character.combatStanceAvailable,
            "INVALID_COMBAT_STANCE"
        );

        character.combatStanceAvailable = character.combatStanceAvailable ^ combatStance;

        Room memory currentRoom = computeRoom(
            roomHash(epoch, character.position),
            // TODO layer 2 epoch Hash
            roomHash(bytes32(0x0000000000000000000000000000000000000000000000000000000000000000), character.position)
        );

        for (uint256 i = 0; i < actions.length; i++) {
            Action memory action = actions[i];
            Room memory newRoom = computeRoom(
                roomHash(epoch, action.position),
                // TODO layer 2 epoch Hash
                roomHash(
                    bytes32(0x0000000000000000000000000000000000000000000000000000000000000000), character.position
                )
            );

            if (_isValidMove(character.position, currentRoom, action.position, newRoom)) {
                character.position = action.position;
                currentRoom = newRoom;
                if (action.pickTreasure) {
                    if (currentRoom.treasure) {
                        _handleGoldBattle(epoch, characterID, character, combatStance);
                    }
                    // } else if (action.battleMonster) {
                    //     if (currentRoom.monster) {
                    //         // Monster monster = room.monster;
                    //         _handleMonsterBattle(epoch, characterID, character, combatStance);
                    //     }
                }
            } else {
                // For now:
                revert("invalid move");

                // we do not continue when we encounter an invalid move
                // for simplicity, we still count was was computed so far
                // TODO alternative: revert the whole moves but keep the commitment
                // break;
            }
        }

        _handleCommitment(characterID, epoch, commitment, actions, furtherActions);

        _handleCharacter(characterID, character);
    }

    function _handleGoldBattle(uint256 epoch, uint256 characterID, Character memory character, uint16 combatStance)
        internal
    {
        GoldBattle memory battle = goldBattles[epoch][character.position];
        if (battle.combatStance == 0) {
            character.gold = character.gold + 1 ether;
            battle.currentWinner = characterID;
            battle.combatStance = combatStance;
        } else {
            // TODO make it commutative
            // or track but limit the number of character that can get the gold
            //  in that case, if that limit is reached, nobody is harmed, nobody get the gold
            int8 result = _battle(combatStance, battle.combatStance);
            if (result >= 0) {
                if (battle.currentWinner != 0) {
                    Character memory previous = characters[battle.currentWinner];
                    previous.gold = previous.gold - 1 ether;
                    previous.life = previous.life - 1; // because of order issue, we need to remove that
                    _handleCharacter(battle.currentWinner, previous);
                }
                if (result > 0) {
                    character.gold = character.gold + 1 ether;
                    battle.currentWinner = characterID;
                    battle.combatStance = combatStance;
                } else {
                    battle.currentWinner = 0;
                    battle.combatStance = combatStance; // hmm prder would matter here depending on how they can be equal
                }
            } else {
                character.life = character.life - 1;
            }
        }

        goldBattles[epoch][character.position] = battle;
    }

    function _handleMonsterBattle(
        uint256 epoch,
        uint256 characterID,
        Character memory character,
        uint16 combatStance,
        Monster memory monster
    ) internal {
        MonsterBattle memory battle = monsterBattles[epoch][character.position];
        battle.life = battle.life == 0 ? monster.life : battle.life;

        int8 result = _battle(combatStance, monster.combatStance);
        if (result > 0) {
            if (battle.life != type(uint256).max) {
                // if not already dead
                battle.life--;
                if (battle.life == 0) {
                    battle.life = type(uint256).max; // monster is dead
                    emit MonsterDefeat(character.position, epoch);
                }
            }
        } else if (result < 0) {
            character.life = character.life - 1;
        }

        if (battle.life == type(uint256).max) {
            // no need to fight, you get a share
            character.gold = character.gold + 2 ether;
            // NOTE that if we want to make it a share
            // we can't give gold now, but need to do it in the post-reveal phase (offchain-present, onchain-future)
        } else {
            monsterClaims[characterID] = epoch; // the position is the last one, we just need to make sure we execute the claim before anything else
            emit MonsterClaim(characterID, character.position, epoch);
        }

        monsterBattles[epoch][character.position] = battle;
    }

    function _handlePlayerBattle(uint256 epoch, uint256 characterID, Character memory character, uint16 combatStance)
        internal
    {
        // We want to enable player to player battle but to be less harsh we need first some temple room where PVP would be disabled
        // Currently the only way to attack other player is when they attempt to get the same gold bags as yourself
    }

    function _battle(uint16 p1_battleStance, uint16 p2_battleStance) internal pure returns (int8 total) {
        uint8 p1_round = 10;
        uint8 p2_round = 10;
        for (uint256 i = 0; i < 3; i++) {
            p1_round = _getNextValue(p1_battleStance, p1_round - 1);
            p2_round = _getNextValue(p2_battleStance, p2_round - 1);
            if (p1_round > p2_round) {
                total = total + 1;
            } else if (p1_round < p2_round) {
                total = total - 1;
            }
        }
    }

    function _getNextValue(uint16 combatStance, uint8 start) internal pure returns (uint8) {
        for (int256 i = (int8(start) - 1); i >= 0; i--) {
            if ((combatStance >> uint256(i)) != 0) {
                return uint8(uint256(i + 1));
            }
        }
        return 0; // invalid
    }

    function _handleCommitment(
        uint256 characterID,
        uint32 epoch,
        Commitment storage commitment,
        Action[] memory actions,
        bytes24 furtherActions
    ) internal {
        bytes24 hashResolved = commitment.hash;
        if (furtherActions != bytes24(0)) {
            commitment.hash = furtherActions;
        } else {
            commitment.epoch = 0; // used
        }

        emit CommitmentResolved(characterID, epoch, hashResolved, actions, furtherActions);
    }

    function _handleEpochHash(uint32 epoch, bytes32 secret) internal {
        // we compute our epochHash as reveal are entered
        // Note that later we might want to only use commitment who has gone deep enough in the dungeon
        if (epoch % 2 == 0) {
            epochHash_1 = secret ^ epochHash_1;
            emit EpochHashUpdate(epoch + 1, epochHash_1);
        } else {
            epochHash_0 = secret ^ epochHash_0;
            emit EpochHashUpdate(epoch + 1, epochHash_0);
        }
    }

    function _handleCharacter(uint256 characterID, Character memory character) internal {
        characters[characterID] = character;

        // CommitmentResolved event contains everything needed for an indexer to recompute the state
        // but here for simplicity we emit the latest data just computed

        emit CharacterUpdate(
            characterID,
            character.position,
            character.life,
            character.gold,
            character.equipment,
            character.combatStanceAvailable
        );
    }

    function roomID(int32 x, int32 y) public pure returns (uint256) {
        unchecked {
            return uint256(uint256(uint64(uint32(y)) << 32) + uint32(x));
        }
    }

    function roomCoords(uint256 id) public pure returns (int32 x, int32 y) {
        unchecked {
            x = int32(int256(id & 0xFFFFFFFF));
            y = int32(int256(id >> 32));
        }
    }

    function roomHash(uint32 epoch, int32 x, int32 y) public view returns (bytes32) {
        return roomHash(epoch, roomID(x, y));
    }

    function roomHash(uint32 epoch, uint256 id) public view returns (bytes32) {
        bytes32 epochHash = epoch % 2 == 0 ? epochHash_0 : epochHash_1;
        return roomHash(epochHash, id);
    }

    function roomHash(bytes32 epochHash, uint256 id) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(epochHash, id));
    }

    function computeRoom(bytes32 roomHashData, bytes32 roomHashData2) public pure returns (Room memory) {
        // // take from the first 0 (right side) and take 2 bits to give you a number between [0,2**2[
        // const firstExit = value(roomHashData, 0, 2);
        uint8 firstExit = uint8(Extraction.value(roomHashData, 0, 2));

        // const hasSecondExit = value(roomHashData, 2, 5) < 3; // take 32 values [0,2**5[
        bool hasSecondExit = uint8(Extraction.value(roomHashData, 2, 5)) < 10;
        // const secondExitRaw = value(roomHashData, 7, 2); // this has one value too much.
        uint8 secondExitRaw = uint8(Extraction.value(roomHashData, 7, 2));
        // const secondExit = hasSecondExit && secondExitRaw < 3 ? secondExitRaw : 4;
        uint8 secondExit = (hasSecondExit && secondExitRaw < 3) ? secondExitRaw : 4;
        // // const thirdExist = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);
        // // const fourthExit = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);

        // const treasure = value(roomHashData, 9, 10) < 7; // take 1024 values [0,2**10[
        bool treasure = Extraction.value(roomHashData2, 9, 10) < 20;

        // const monsterRaw = value(roomHashData, 19, 7); // take 128 values [0,2**7[
        // TODO roomHashData3 ?
        uint8 monsterRaw = uint8(Extraction.value(roomHashData, 19, 7));
        // const monster = treasure ? monsterRaw < 30 : monsterRaw < 1;
        bool monster = treasure ? monsterRaw < 30 : monsterRaw < 1;

        return Room({
            exits: [
                firstExit == 0 || secondExit == 0,
                firstExit == 1 || secondExit == 1,
                firstExit == 2 || secondExit == 2,
                firstExit == 3 || secondExit == 3
            ],
            treasure: treasure,
            monster: monster
        });
    }

    // ----------------------------------------------------------------------------------------------
    // INTERNAL
    // ----------------------------------------------------------------------------------------------

    function _makeCommitment(uint256 characterID, bytes24 commitmentHash) internal {
        Commitment storage commitment = commitments[characterID];

        (uint32 epoch, bool commiting) = _epoch();

        console.log("epoch");
        console.logUint(epoch);

        // TODO extract this into a separate function that can also be called by anyone (past the corresponding reveal phase)
        //  Would be used to claim the gold, equipment, etc...
        if (commitment.epoch != 0 && commitment.epoch != epoch) {
            characters[characterID].life = 0;
            commitment.epoch = 0;

            emit CommitmentVoid(characterID, epoch);

            // CommitmentVoid event contains everything needed for an indexer to recompute the state
            // but here for simplicity we emit the latest data just computed
            emit CharacterUpdate(
                characterID,
                characters[characterID].position,
                characters[characterID].life,
                characters[characterID].gold,
                characters[characterID].equipment,
                0
            );
        }

        require(commiting, "IN_RESOLUTION_PHASE");
        require(commitment.epoch == 0 || commitment.epoch == epoch, "PREVIOUS_COMMITMENT_TO_RESOLVE");

        commitment.hash = commitmentHash;
        commitment.epoch = epoch;

        // Note: A character can change its commitment at any time until the commit phase ends.
        emit CommitmentMade(characterID, epoch, commitmentHash);
    }

    function _checkHash(
        bytes24 commitmentHash,
        bytes32 secret,
        Action[] memory actions,
        uint16 combatStance,
        bytes24 furtherActions
    ) internal pure {
        if (furtherActions != bytes24(0)) {
            bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions, combatStance, furtherActions)));
            require(commitmentHash == computedHash, "HASH_NOT_MATCHING");
        } else {
            bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions, combatStance)));
            require(commitmentHash == computedHash, "HASH_NOT_MATCHING");
        }
    }

    function _epoch() internal view virtual returns (uint32 epoch, bool commiting) {
        uint256 epochDuration = TOTAL;

        // For now START_TIMESTAMP = 0
        require(_timestamp() >= START_TIMESTAMP, "GAME_NOT_STARTED");

        uint256 timePassed = _timestamp() - START_TIMESTAMP;
        epoch = uint32((timePassed / epochDuration) + 1);
        commiting = timePassed - ((epoch - 1) * epochDuration) < ACTION_PERIOD;
    }

    function _isValidMove(uint256 roomPosition, Room memory room, uint256 newPosition, Room memory newRoom)
        internal
        view // pure
        returns (bool)
    {
        (int32 x, int32 y) = roomCoords(roomPosition);
        (int32 nx, int32 ny) = roomCoords(newPosition);
        if (x == nx && y == ny) {
            console.log("same");
            return true;
        }
        uint8 direction = _direction(x, y, nx, ny);
        if (direction == 4) {
            return false;
        }
        return room.exits[direction] || newRoom.exits[(direction + 2) % 4];
    }

    function _direction(int32 fromx, int32 fromy, int32 tox, int32 toy) internal pure returns (uint8) {
        int64 x_diff = int64(tox) - fromx;
        int64 y_diff = int64(toy) - fromy;
        if (x_diff == 0) {
            if (y_diff == 1) {
                return 2;
            } else if (y_diff == -1) {
                return 0;
            } else {
                return 4; // undefined
            }
        } else {
            if (x_diff == 1) {
                return 1;
            } else if (x_diff == -1) {
                return 3;
            } else {
                return 4; // undefined
            }
        }
    }

    function _timestamp() internal view virtual override returns (uint256) {
        return block.timestamp;
    }
}
