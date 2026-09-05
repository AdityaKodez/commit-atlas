import { Button } from "@/components/ui/button";

export type NavItem = { slug: string; label: string; count: number };

export function PillNav({ items }: { items: NavItem[] }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <nav
        aria-label="Repositories"
        className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span className="mr-2 shrink-0 text-sm font-extrabold tracking-tight">
          Commit Atlas
        </span>
        {items.map((item) => (
          <Button
            key={item.slug}
            asChild
            variant="outline"
            size="xs"
            className="shrink-0 rounded-full font-normal"
          >
            <a href={`#${item.slug}`}>
              {item.label}
              <span className="ml-1.5 tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </a>
          </Button>
        ))}
      </nav>
    </header>
  );
}
