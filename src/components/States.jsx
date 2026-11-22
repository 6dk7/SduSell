export function EmptyState({ title, text, children }) {
  return <div className="empty"><h2>{title}</h2><p>{text}</p>{children}</div>;
}

export function PageError({ error, onRetry }) {
  if (error?.status === 404) {
    return (
      <div className="page narrow">
        <EmptyState title="Listing not found" text="It may have been deleted or marked as sold.">
          <a className="btn btn-primary" href="#/">Go to all listings</a>
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="page narrow">
      <EmptyState title="We could not load this page" text={error?.message || 'Something went wrong. Try again.'}>
        <button className="btn btn-primary" type="button" onClick={onRetry}>Try again</button>
      </EmptyState>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page narrow">
      <EmptyState title="Page not found" text="This address does not lead anywhere on SduSell.">
        <a className="btn btn-primary" href="#/">Go to all listings</a>
      </EmptyState>
    </div>
  );
}
