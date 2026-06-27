import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore iOS
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setInstalled(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIOS()) {
      setShowIOS(true);
      return;
    }
    setShowIOS(true);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ring-1 ring-brand/40 bg-brand/10 text-brand text-xs font-medium hover:bg-brand/20 transition-colors"
        title="Instalar PXOne como aplicativo"
      >
        <Download className="size-3.5" />
        <span className="hidden sm:inline">Instalar app</span>
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowIOS(false)}
        >
          <div
            className="w-full max-w-sm bg-surface ring-1 ring-border rounded-xl p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOS(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <h3 className="text-sm font-semibold mb-2">Instalar PXOne</h3>
            {isIOS() ? (
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
                <li>Toque no botão <Share className="size-3.5 inline -mt-0.5" /> Compartilhar do Safari.</li>
                <li>Role e selecione <strong>Adicionar à Tela de Início</strong>.</li>
                <li>Confirme em <strong>Adicionar</strong>.</li>
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">
                No menu do seu navegador, escolha <strong>Instalar app</strong> ou
                <strong> Adicionar à tela inicial</strong>. Em alguns navegadores a opção aparece
                na barra de endereço.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
