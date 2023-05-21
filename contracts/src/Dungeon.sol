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
    uint256 constant ACTION_period = 23 * 3600;
    uint256 constant START_TIMESTAMP = 0;

    // ----------------------------------------------------------------------------------------------
    // EVENTS
    // ----------------------------------------------------------------------------------------------
    event CommitmentMade(address indexed player, uint32 indexed epoch, bytes24 commitmentHash);
    event CommitmentVoid(address indexed player, uint32 indexed epoch);
    event CommitmentResolved(
        address indexed player,
        uint32 indexed epoch,
        bytes24 indexed commitmentHash,
        Action[] actions,
        bytes24 furtherActions
    );

    event PlayerUpdate(address indexed player, uint256 indexed position, uint8 life, uint256 gold, bytes32 equipment);
    event RoomUpdate(uint256 indexed position, bytes32 goldBattle, bytes32 monsterBattle);
    event EpochHashUpdate(uint256 indexed epoch, bytes32 epochHash);

    // ----------------------------------------------------------------------------------------------
    // TYPES
    // ----------------------------------------------------------------------------------------------

    struct Character {
        uint256 position;
        uint256 gold;
        uint8 life;
        bytes32 equipment;
    }

    // this only track what changes
    // when life is zero,
    // gold and equiipment are considered taken
    // uint256 gold;
    // bytes32 equipment;

    // struct Monster {
    //     uint8 life;
    // }

    struct RoomStatus {
        bytes32 goldBattle; // this represent a battle against other player with gold given to winner
        bytes32 monsterBattle; // this represent a battle against a monster with loot shared (based on success? // or same/similar like goldBattle)
    }

    struct Commitment {
        bytes24 hash;
        uint32 epoch;
    }

    struct Action {
        uint256 position; // TODO uint64
    }

    struct Room {
        bool[4] exits;
        bool chest;
        bool monster;
    }

    mapping(uint256 => RoomStatus) public roomStatus;
    mapping(address => Character) public characters;
    mapping(address => Commitment) public commitments;

    bytes32 internal epochHash_0;
    bytes32 internal epochHash_1;

    // ----------------------------------------------------------------------------------------------
    // STORAGE
    // ----------------------------------------------------------------------------------------------

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

    function makeCommitment(bytes24 commitmentHash) external {
        _makeCommitment(msg.sender, commitmentHash);
    }

    function resolve(address player, bytes32 secret, Action[] calldata actions, bytes24 furtherActions) external {
        Commitment storage commitment = commitments[player];
        (uint32 epoch, bool commiting) = _epoch();

        require(!commiting, "IN_COMMITING_PHASE");
        require(commitment.epoch != 0, "NOTHING_TO_RESOLVE");
        require(commitment.epoch == epoch, "INVALID_epoch");

        _checkHash(commitment.hash, secret, actions, furtherActions);

        Character memory character = characters[player];
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
                break;
            }
        }

        _handleCommitment(player, epoch, commitment, actions, furtherActions);
        _handleEpochHash(epoch, secret);
        _handleCharacter(player, character);
    }

    function _handleCommitment(
        address player,
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

        emit CommitmentResolved(player, epoch, hashResolved, actions, furtherActions);
    }

    function _handleEpochHash(uint32 epoch, bytes32 secret) internal {
        // we compute our epochHash as reveal are entered
        // Note that later we might want to only use commitment who has gone deep enough in the dungeon
        if (epoch % 2 == 0) {
            console.log("epoch % 2 == 0, we modify epochHash_1");
            console.logUint(epoch);
            console.log("before");
            console.logBytes32(epochHash_1);
            epochHash_1 = secret ^ epochHash_1;
            console.log("after");
            console.logBytes32(epochHash_1);
            emit EpochHashUpdate(epoch + 1, epochHash_1);
        } else {
            console.log("epoch % 2 == 1, we modify epochHash_0");
            console.logUint(epoch);
            console.log("before");
            console.logBytes32(epochHash_0);
            epochHash_0 = secret ^ epochHash_0;
            console.log("after");
            console.logBytes32(epochHash_0);
            emit EpochHashUpdate(epoch + 1, epochHash_0);
        }
    }

    function _handleCharacter(address player, Character memory character) internal {
        characters[player] = character;

        // CommitmentResolved event contains everything needed for an indexer to recompute the state
        // but here for simplicity we emit the latest data just computed

        emit PlayerUpdate(player, character.position, character.life, character.gold, character.equipment);
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
        // uint32 epoch = getEpoch();
        bytes32 epochHash = epoch % 2 == 0 ? epochHash_0 : epochHash_1;

        // console.log("epoch");
        // console.logUint(epoch);
        // console.log("epoch % 2 == 0");
        // console.logBool(epoch % 2 == 0);
        // console.log("epoch % 2 == 0 ? epochHash_0 : epochHash_1");
        // console.logBytes32(epoch % 2 == 0 ? epochHash_0 : epochHash_1);
        // console.log("epochHash_0");
        // console.logBytes32(epochHash_0);
        // console.log("epochHash_1");
        // console.logBytes32(epochHash_1);

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

    function _makeCommitment(address player, bytes24 commitmentHash) internal {
        Commitment storage commitment = commitments[player];

        (uint32 epoch, bool commiting) = _epoch();

        console.log("epoch");
        console.logUint(epoch);

        if (commitment.epoch != 0 && commitment.epoch != epoch) {
            // TODO make it count
            // if we set to zero life, then we should make it a separate tx, for anyone to claim ? instea do inside this if statement
            characters[msg.sender].life = 0;
            commitment.epoch = 0;

            emit CommitmentVoid(player, epoch);

            // CommitmentVoid event contains everything needed for an indexer to recompute the state
            // but here for simplicity we emit the latest data just computed
            emit PlayerUpdate(player, characters[player].position, 0, 0, bytes32(0));
        }

        require(commiting, "IN_RESOLUTION_PHASE");
        require(commitment.epoch == 0 || commitment.epoch == epoch, "PREVIOUS_COMMITMENT_TO_RESOLVE");

        commitment.hash = commitmentHash;
        commitment.epoch = epoch;

        // Note: A player can change its commitment at any time until the commit phase ends.
        emit CommitmentMade(player, epoch, commitmentHash);
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
        commiting = timePassed - ((epoch - 1) * epochDuration) < ACTION_period;
    }

    function _isValidMove(uint256 roomPosition, Room memory room, uint256 newPosition, Room memory newRoom)
        internal
        view // pure
        returns (bool)
    {
        (int32 x, int32 y) = roomCoords(roomPosition);
        (int32 nx, int32 ny) = roomCoords(newPosition);
        uint8 direction = _direction(x, y, nx, ny);
        console.log("x");
        console.logInt(x);
        console.log("y");
        console.logInt(y);
        console.log("nx");
        console.logInt(nx);
        console.log("ny");
        console.logInt(ny);
        console.log("direction");
        console.logUint(direction);
        if (direction == 4) {
            return false;
        }
        console.log("room.exits[direction]");
        console.logBool(room.exits[direction]);
        console.log("newRoom.exits[(direction + 2) % 4]");
        console.log("oposite direction");
        console.log("(direction + 2) % 4");
        console.log((direction + 2) % 4);
        console.logBool(newRoom.exits[(direction + 2) % 4]);
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
