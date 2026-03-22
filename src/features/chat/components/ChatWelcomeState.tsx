export function ChatWelcomeState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-4 text-center text-muted-foreground">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-red-500">
          <div className="h-4 w-4 rounded-full bg-red-500" />
        </div>
      </div>
      <h3 className="mb-2 text-xl font-bold text-foreground">Welcome to Voca</h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        A new era secure and fast messenger. Select a user from the sidebar to start chatting.
      </p>
    </div>
  );
}
