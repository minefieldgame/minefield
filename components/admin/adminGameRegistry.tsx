import type { ComponentType } from "react";
import AdminNeedleDropPreview from "@/components/admin/AdminNeedleDropPreview";
import AdminOddOneOutPreview, { type AdminOddOneOutPreviewData } from "@/components/admin/AdminOddOneOutPreview";
import AdminVaultbreakPreview from "@/components/admin/AdminVaultbreakPreview";
import AdminSingAlongPreview from "@/components/admin/AdminSingAlongPreview";
import AdminTopTenPreview from "@/components/admin/AdminTopTenPreview";
import AdminSpellDropPreview from "@/components/admin/AdminSpellDropPreview";
import AdminMinefieldPreview from "@/components/admin/AdminMinefieldPreview";
import AdminCloserPreview from "@/components/admin/AdminCloserPreview";
import { AdminLandmarkDropPreview, AdminMeetMeHalfwayPreview } from "@/components/admin/AdminGeographyPreviews";
import type { AdminPreviewResponse } from "@/types/admin";

export type AdminGamePreviewProps = {
  data: AdminPreviewResponse;
  onRegenerate: () => void;
  onRetryTopTen: () => void;
};

function NeedleDropModule({ data, onRegenerate }: AdminGamePreviewProps) {
  return <AdminNeedleDropPreview preview={data.games.needledrop} date={data.date} onRegenerate={onRegenerate} />;
}

function OddOneOutModule({ data, onRegenerate }: AdminGamePreviewProps) {
  const games = data.games as typeof data.games & { oddOneOut?: AdminOddOneOutPreviewData };
  return <AdminOddOneOutPreview preview={games.oddOneOut} onRegenerate={onRegenerate} />;
}

function VaultbreakModule({ data, onRegenerate }: AdminGamePreviewProps) {
  return <AdminVaultbreakPreview preview={data.games.vaultbreak} onRegenerate={onRegenerate} />;
}

function SingAlongModule({ data }: AdminGamePreviewProps) {
  return <AdminSingAlongPreview preview={data.games.singAlong} />;
}

function TopTenModule({ data, onRegenerate, onRetryTopTen }: AdminGamePreviewProps) {
  return (
    <AdminTopTenPreview
      preview={data.games.topTen}
      date={data.date}
      onRegenerate={onRegenerate}
      onRetryCategory={onRetryTopTen}
    />
  );
}

function SpellDropModule({ data }: AdminGamePreviewProps) {
  return <AdminSpellDropPreview preview={data.games.spellDrop} date={data.date} />;
}

function MinefieldModule({ data, onRegenerate }: AdminGamePreviewProps) {
  return <AdminMinefieldPreview preview={data.games.minefield} onRegenerate={onRegenerate} />;
}

function CloserModule({ data, onRegenerate }: AdminGamePreviewProps) {
  return <AdminCloserPreview preview={data.games.closer} date={data.date} onRegenerate={onRegenerate} />;
}

function MeetMeHalfwayModule({ data }: AdminGamePreviewProps) {
  return <AdminMeetMeHalfwayPreview preview={data.games.meetMeHalfway} />;
}

function LandmarkDropModule({ data }: AdminGamePreviewProps) {
  return <AdminLandmarkDropPreview preview={data.games.landmarkDrop} />;
}

export const adminGameRegistry: Array<{
  gameId: string;
  displayName: string;
  AdminPreviewComponent: ComponentType<AdminGamePreviewProps>;
}> = [
  {
    gameId: "needledrop",
    displayName: "Rewind",
    AdminPreviewComponent: NeedleDropModule
  },
  {
    gameId: "odd-one-out",
    displayName: "Odd One Out",
    AdminPreviewComponent: OddOneOutModule
  },
  {
    gameId: "vaultbreak",
    displayName: "Vaultbreak",
    AdminPreviewComponent: VaultbreakModule
  },
  {
    gameId: "ranked-top-5",
    displayName: "In Order",
    AdminPreviewComponent: TopTenModule
  },
  {
    gameId: "spelldrop",
    displayName: "Buzzword",
    AdminPreviewComponent: SpellDropModule
  },
  {
    gameId: "closer",
    displayName: "In the Ballpark",
    AdminPreviewComponent: CloserModule
  },
  {
    gameId: "meet-me-halfway",
    displayName: "Meet Me Halfway",
    AdminPreviewComponent: MeetMeHalfwayModule
  },
  {
    gameId: "landmark-drop",
    displayName: "On a Postcard",
    AdminPreviewComponent: LandmarkDropModule
  },
  {
    gameId: "minefield",
    displayName: "Minefield",
    AdminPreviewComponent: MinefieldModule
  }
];

export const retiredAdminGameRegistry: Array<{
  gameId: string;
  displayName: string;
  AdminPreviewComponent: ComponentType<AdminGamePreviewProps>;
}> = [
  {
    gameId: "sing-along",
    displayName: "Sing Along — Retired",
    AdminPreviewComponent: SingAlongModule
  }
];
