"use client";

import GameShell from "@/components/GameShell";
import type { MinefieldGameResult } from "@/types/minefield";

export const needledropDefinition = {
  gameId: "needledrop" as const,
  displayName: "NeedleDrop",
  maxScore: 100
};

export default function NeedleDropGame({
  onComplete,
  date,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  return <GameShell embedded onComplete={onComplete} date={date} storageScope={storageScope} />;
}
