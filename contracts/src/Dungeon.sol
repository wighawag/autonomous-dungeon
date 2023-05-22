// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "forge-deploy-proxy/ForgeDeploy_Proxied.sol";
import "./Extraction.sol";
import "forge-std/console.sol";

contract Dungeon is Proxied {
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
        uint256 indexed characterID, uint256 indexed position, uint8 life, uint256 gold, bytes32 equipment
    );
    event RoomUpdate(uint256 indexed position, bytes32 goldBattle, bytes32 monsterBattle);
    event EpochHashUpdate(uint256 indexed epoch, bytes32 epochHash);
    event CharacterEnterTheDungeon(address indexed player, uint256 indexed characterID);

    // ----------------------------------------------------------------------------------------------
    // STORAGE TYPES
    // ----------------------------------------------------------------------------------------------

    struct Character {
        uint256 position;
        uint256 gold;
        uint8 life;
        bytes32 equipment;
    }

    struct RoomStatus {
        bytes32 goldBattle; // this represent a battle against other character with gold given to winner
        bytes32 monsterBattle; // this represent a battle against a monster with loot shared (based on success? // or same/similar like goldBattle)
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

    // struct Monster {
    //     uint8 life;
    // }

    struct Action {
        uint256 position; // TODO uint64
    }

    struct Room {
        bool[4] exits;
        bool chest;
        bool monster;
    }

    // ----------------------------------------------------------------------------------------------
    // STORAGE
    // ----------------------------------------------------------------------------------------------

    mapping(uint256 => RoomStatus) public roomStatus;
    mapping(uint256 => Character) public characters;
    mapping(uint256 => address) public owners;
    mapping(uint256 => Commitment) public commitments;

    bytes32 internal epochHash_0;
    bytes32 internal epochHash_1;

    // ----------------------------------------------------------------------------------------------
    // CONSTRUCTOR / INITIALIZER
    // ----------------------------------------------------------------------------------------------

    constructor() {
        postUpgrade();
    }

    function postUpgrade() public proxied {}

    // ----------------------------------------------------------------------------------------------
    // PUBLIC INTERFACE
    // ----------------------------------------------------------------------------------------------

    function enter(uint256 characterID) external payable {
        require(msg.value == 1000000000000000, "GIVE ME THE KWEI");
        // TODO check ownership and transfer NFT
        // for now we use the player address as character id
        // we also ensure you cannot enter twice
        // TODO leaving the dungeon
        characterID = uint256(uint160(msg.sender));
        require(owners[characterID] == address(0), "ALREADY_IN");

        owners[characterID] = msg.sender;
        emit CharacterEnterTheDungeon(msg.sender, characterID);

        _handleCharacter(characterID, Character({position: 0, life: 3, gold: 0, equipment: bytes32(0)}));
    }

    function makeCommitment(uint256 characterID, bytes24 commitmentHash) external {
        require(owners[characterID] == msg.sender, "NOT_OWNER");
        Character memory character = characters[characterID];
        require(character.life > 0, "DEAD");
        _makeCommitment(characterID, commitmentHash);
    }

    function resolve(uint256 characterID, bytes32 secret, Action[] calldata actions, bytes24 furtherActions) external {
        Commitment storage commitment = commitments[characterID];
        (uint32 epoch, bool commiting) = _epoch();

        require(!commiting, "IN_COMMITING_PHASE");
        require(commitment.epoch != 0, "NOTHING_TO_RESOLVE");
        require(commitment.epoch == epoch, "INVALID_epoch");

        _checkHash(commitment.hash, secret, actions, furtherActions);

        Character memory character = characters[characterID];
        Room memory currentRoom = computeRoom(roomHash(epoch, character.position));

        for (uint256 i = 0; i < actions.length; i++) {
            Action memory action = actions[i];
            Room memory newRoom = computeRoom(roomHash(epoch, action.position));

            if (_isValidMove(character.position, currentRoom, action.position, newRoom)) {
                character.position = action.position;
                currentRoom = newRoom;
            } else {
                // For now:
                revert("invalid move");

                // we do not continue when we encounter an invalid move
                // for simplicity, we still count was was computed so far
                // TODO alternative: revert the whole moves but keep the commitment
                break;
            }
        }

        _handleCommitment(characterID, epoch, commitment, actions, furtherActions);
        _handleEpochHash(epoch, secret);
        _handleCharacter(characterID, character);
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

        emit CharacterUpdate(characterID, character.position, character.life, character.gold, character.equipment);
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
        return keccak256(abi.encodePacked(epochHash, id));
    }

    function computeRoom(bytes32 roomHashData) public pure returns (Room memory) {
        // // take from the first 0 (right side) and take 2 bits to give you a number between [0,2**2[
        // const firstExit = value(roomHashData, 0, 2);
        uint8 firstExit = uint8(Extraction.value(roomHashData, 0, 2));

        // const hasSecondExit = value(roomHashData, 2, 5) < 3; // take 32 values [0,2**5[
        bool hasSecondExit = uint8(Extraction.value(roomHashData, 2, 5)) < 3;
        // const secondExitRaw = value(roomHashData, 7, 2); // this has one value too much.
        uint8 secondExitRaw = uint8(Extraction.value(roomHashData, 7, 2));
        // const secondExit = hasSecondExit && secondExitRaw < 3 ? secondExitRaw : 4;
        uint8 secondExit = (hasSecondExit && secondExitRaw < 3) ? secondExitRaw : 4;
        // // const thirdExist = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);
        // // const fourthExit = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);

        // const chest = value(roomHashData, 9, 10) < 7; // take 1024 values [0,2**10[
        bool chest = Extraction.value(roomHashData, 9, 10) < 7;

        // const monsterRaw = value(roomHashData, 19, 7); // take 128 values [0,2**7[
        uint8 monsterRaw = uint8(Extraction.value(roomHashData, 19, 7));
        // const monster = chest ? monsterRaw < 30 : monsterRaw < 1;
        bool monster = chest ? monsterRaw < 30 : monsterRaw < 1;

        return Room({
            exits: [
                firstExit == 0 || secondExit == 0,
                firstExit == 1 || secondExit == 1,
                firstExit == 2 || secondExit == 2,
                firstExit == 3 || secondExit == 3
            ],
            chest: chest,
            monster: monster
        });
    }

    // ----------------------------------------------------------------------------------------------
    // INTERNALS
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
                characters[characterID].equipment
            );
        }

        require(commiting, "IN_RESOLUTION_PHASE");
        require(commitment.epoch == 0 || commitment.epoch == epoch, "PREVIOUS_COMMITMENT_TO_RESOLVE");

        commitment.hash = commitmentHash;
        commitment.epoch = epoch;

        // Note: A character can change its commitment at any time until the commit phase ends.
        emit CommitmentMade(characterID, epoch, commitmentHash);
    }

    function _checkHash(bytes24 commitmentHash, bytes32 secret, Action[] memory actions, bytes24 furtherActions)
        internal
        pure
    {
        if (furtherActions != bytes24(0)) {
            bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions, furtherActions)));
            require(commitmentHash == computedHash, "HASH_NOT_MATCHING");
        } else {
            bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions)));
            require(commitmentHash == computedHash, "HASH_NOT_MATCHING");
        }
    }

    function _epoch() internal view virtual returns (uint32 epoch, bool commiting) {
        uint256 epochDuration = TOTAL;

        // For now START_TIMESTAMP = 0
        require(block.timestamp >= START_TIMESTAMP, "GAME_NOT_STARTED");

        uint256 timePassed = block.timestamp - START_TIMESTAMP;
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
}
