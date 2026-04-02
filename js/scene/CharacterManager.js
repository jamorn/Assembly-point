import { MinecraftCharacter } from "./Character.js";

export class CharacterManager {
    constructor(scene, resources) {
        this.scene = scene;
        this.resources = resources;
        this.characters = [];
        this.charactersById = new Map();
    }

    load(roster) {
        this.disposeAll();
        this.characters = roster.map((member) => {
            const character = new MinecraftCharacter(member, this.resources);
            this.scene.add(character.group);
            return character;
        });
        this.charactersById = new Map(this.characters.map((character) => [character.id, character]));
        return this.characters;
    }

    updateAll(deltaTime) {
        const orderedCharacters = [...this.characters].sort(
            (left, right) => left.getUpdateOrder() - right.getUpdateOrder()
        );
        orderedCharacters.forEach((character) => character.update(this.characters, deltaTime, this.charactersById));
    }

    setRoamMode() {
        this.characters.forEach((character) => character.setRoamMode(true));
    }

    getCharacterById(characterId) {
        return this.charactersById.get(characterId) || null;
    }

    getManager() {
        return this.characters.find((character) => character.role === "manager") || null;
    }

    setManagerAnnouncement(text) {
        this.getManager()?.setAnnouncement(text);
    }

    clearManagerAnnouncement() {
        this.getManager()?.clearAnnouncement();
    }

    clearUnavailableState() {
        this.characters.forEach((character) => character.setUnavailable(false));
    }

    markUnavailable(characterId) {
        this.getCharacterById(characterId)?.setUnavailable(true);
    }

    selectUnavailableOperator(layout) {
        let selectedCharacter = null;
        let furthestDistance = -1;

        this.characters.forEach((character) => {
            if (character.role !== "operator") {
                return;
            }

            const slot = layout.get(character.id);
            if (!slot) {
                return;
            }

            const distance = character.getDistanceToPoint(slot.x, slot.z);
            if (distance <= furthestDistance) {
                return;
            }

            selectedCharacter = character;
            furthestDistance = distance;
        });

        if (!selectedCharacter) {
            return null;
        }

        return {
            id: selectedCharacter.id,
            displayName: selectedCharacter.displayName,
            distance: furthestDistance
        };
    }

    applyFormation(layout) {
        this.characters.forEach((character) => {
            const slot = layout.get(character.id);
            if (slot) {
                character.setFormationTarget(slot);
            }
        });
    }

    areAllInFormation() {
        return this.characters.every((character) => character.isUnavailable || character.isInFormation());
    }

    getStats() {
        return {
            active: this.characters.length,
            pooled: 0
        };
    }

    disposeAll() {
        this.characters.forEach((character) => character.dispose());
        this.characters = [];
        this.charactersById.clear();
    }
}