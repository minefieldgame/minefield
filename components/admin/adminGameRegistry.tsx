import type { ComponentType } from "react";
import AdminNeedleDropPreview from "@/components/admin/AdminNeedleDropPreview";
import AdminTopTenPreview from "@/components/admin/AdminTopTenPreview";
import AdminSpellDropPreview from "@/components/admin/AdminSpellDropPreview";
import type { AdminPreviewResponse } from "@/types/admin";

export type AdminGamePreviewProps = {
  data: AdminPreviewResponse;
  onRegenerate: () => void;
  onRetryTopTen: () => void;
};

function NeedleDropModule({ data, onRegenerate }: AdminGamePreviewProps) {
  return <AdminNeedleDropPreview preview={data.games.needledrop} date={data.date} onRegenerate={onRegenerate} />;
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
  return <AdminSpellDropPreview preview={data.games.spellDrop} />;
}

export const adminGameRegistry: Array<{
  gameId: string;
  displayName: string;
  AdminPreviewComponent: ComponentType<AdminGamePreviewProps>;
}> = [
  {
    gameId: "needledrop",
    displayName: "NeedleDrop",
    AdminPreviewComponent: NeedleDropModule
  },
  {
    gameId: "top-ten",
    displayName: "Top 3",
    AdminPreviewComponent: TopTenModule
  },
  {
    gameId: "spelldrop",
    displayName: "SpellDrop",
    AdminPreviewComponent: SpellDropModule
  }
];
