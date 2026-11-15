import { initials } from "../../lib/format";

export default function Avatar({ user, size = "md" }) {
  const dim = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt=""
        className={`${dim} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${dim} grid place-items-center rounded-full bg-[#00a884] font-semibold text-white`}
    >
      {initials(user?.displayName || user?.email)}
    </div>
  );
}
