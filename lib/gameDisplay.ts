import type { MinefieldGameId } from "@/types/minefield";

export const GAME_DISPLAY: Record<MinefieldGameId, {
  name: string;
  icon: string;
  instruction: string;
}> = {
  needledrop: {
    name: "Rewind",
    icon: "🎵",
    instruction: "Rewind this date through music history."
  },
  "odd-one-out": {
    name: "Odd One Out",
    icon: "🧩",
    instruction: "Find the one item that does not belong."
  },
  "sing-along": {
    name: "Sing Along",
    icon: "🎤",
    instruction: "Retired legacy game."
  },
  "ranked-top-5": {
    name: "In Order",
    icon: "🏆",
    instruction: "Put the five items in the correct order."
  },
  spelldrop: {
    name: "Buzzword",
    icon: "🔤",
    instruction: "Hear the word. Spell it correctly."
  },
  closer: {
    name: "In the Ballpark",
    icon: "🎯",
    instruction: "Guess the number. Closer is better."
  },
  "meet-me-halfway": {
    name: "Meet Me Halfway",
    icon: "🌍",
    instruction: "Drop a pin halfway between two places."
  },
  "landmark-drop": {
    name: "On a Postcard",
    icon: "🗼",
    instruction: "Drop a pin where this landmark is located."
  },
  minefield: {
    name: "Minefield",
    icon: "💣",
    instruction: "Final challenge: avoid the mines and survive the board."
  }
};

export const ACTIVE_GAME_IDS = [
  "needledrop",
  "odd-one-out",
  "ranked-top-5",
  "spelldrop",
  "closer",
  "meet-me-halfway",
  "landmark-drop",
  "minefield"
] as const satisfies readonly MinefieldGameId[];

export const PRELIMINARY_GAME_IDS = ACTIVE_GAME_IDS.filter(
  (gameId): gameId is Exclude<(typeof ACTIVE_GAME_IDS)[number], "minefield"> => gameId !== "minefield"
);

export function getGameDisplay(gameId: MinefieldGameId) {
  return GAME_DISPLAY[gameId];
}
