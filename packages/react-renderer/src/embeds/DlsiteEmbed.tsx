"use client";

import { Card, CardContent } from "../components/ui/card";

export interface DlsiteEmbedProps {
  url: string;
}

// DLsite はサイト側が <iframe> 埋め込みを提供しないため、リンクカードにフォールバック。
export function DlsiteEmbed({ url }: DlsiteEmbedProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="p-4 text-sm">
          <div className="font-medium">DLsite</div>
          <div className="truncate text-xs text-muted-foreground">{url}</div>
        </CardContent>
      </Card>
    </a>
  );
}
