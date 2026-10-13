// Replace client/public/logo.svg with the official Presidency University logo
// (keep the file name, or change the src below if you use logo.png).
export default function Logo({ size = 56, text = true }) {
  return (
    <div className="logo">
      <img src="/logo.svg" alt="Presidency University" height={size} width={size} />
      {text && (
        <div>
          <div className="logo-title">Presidency University</div>
          <div className="logo-sub">Online Examination Portal</div>
        </div>
      )}
    </div>
  );
}
