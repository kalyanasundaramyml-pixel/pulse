export function AnonymityBadge({ isAnonymous }: { isAnonymous: boolean }) {
  return (
    <div className={`anonymity-badge ${isAnonymous ? 'anonymous' : 'attributed'}`}>
      {isAnonymous
        ? 'This survey is Anonymous — your name will not be linked to your answers.'
        : 'This survey is Attributed — your responses will be linked to your name.'}
    </div>
  );
}
