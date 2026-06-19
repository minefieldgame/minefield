"use client";

import GameShell from "@/components/GameShell";
import type { MinefieldGameResult } from "@/types/minefield";

export const needledropDefinition = {
  gameId: "needledrop" as const,
  displayName: "NeedleDrop",
  maxScore: 100
};

export default function NeedleDropGame({
  onComplete
}: {
  onComplete: (result: MinefieldGameResult) => void;
}) {
  return <GameShell embedded onComplete={onComplete} />;
}
