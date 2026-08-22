// Discovery › Signals — deliberately empty.
//
// The whole signal surface was deleted in MESITA-1183: 3,114 lines of admin
// config across this tree, none of which any consumer path ever read. It is
// being rebuilt from scratch as seven scoring micro-functions (MESITA-1196),
// and this page is the empty lot it gets built on. Do not reintroduce config
// here ahead of that rebuild.
export default function DiscoverySignalsPage() {
  return <p className="text-muted-foreground text-sm">hello world</p>;
}
