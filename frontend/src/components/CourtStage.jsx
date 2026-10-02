export default function CourtStage({
  active = "judge",
  compact = false,
  processing = false,
  children,
}) {
  return (
    <div
      className={`court-stage ${compact ? "stage-preview" : ""} ${processing ? "stage-thinking" : ""}`}
    >
      <img
        className="stage-background"
        src="/art/courtroom.webp"
        alt=""
        fetchPriority="high"
      />
      <div className="stage-vignette" />
      {["petitioner", "judge", "respondent"].map((role) => (
        <div
          key={role}
          className={`stage-actor actor-${role} ${active === role ? "actor-speaking" : ""}`}
        >
          <img src={`/art/${role}.webp`} alt="" draggable="false" />
          <div className="actor-desk" />
        </div>
      ))}
      <div className="stage-caption">
        <span className="recording-dot" /> COURTROOM NO. 01 <span>THEMIS</span>
      </div>
      {children}
    </div>
  );
}
