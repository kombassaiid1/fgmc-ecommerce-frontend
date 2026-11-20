import { FaFacebookF, FaInstagram, FaLinkedinIn, FaPinterestP, FaSnapchat, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";

import type { SOCIAL_ORDER } from "@/lib/footer";

/** The logo and name of each social network the shop can link to (see "Informations de la boutique"). */
export const SOCIAL_ICONS: Record<(typeof SOCIAL_ORDER)[number], { label: string; icon: React.ReactNode }> = {
  facebook: { label: "Facebook", icon: <FaFacebookF className="size-[18px]" aria-hidden="true" /> },
  instagram: { label: "Instagram", icon: <FaInstagram className="size-5" aria-hidden="true" /> },
  x: { label: "X (Twitter)", icon: <FaXTwitter className="size-[18px]" aria-hidden="true" /> },
  youtube: { label: "YouTube", icon: <FaYoutube className="size-5" aria-hidden="true" /> },
  tiktok: { label: "TikTok", icon: <FaTiktok className="size-[18px]" aria-hidden="true" /> },
  linkedin: { label: "LinkedIn", icon: <FaLinkedinIn className="size-[18px]" aria-hidden="true" /> },
  pinterest: { label: "Pinterest", icon: <FaPinterestP className="size-[18px]" aria-hidden="true" /> },
  whatsapp: { label: "WhatsApp", icon: <FaWhatsapp className="size-5" aria-hidden="true" /> },
  snapchat: { label: "Snapchat", icon: <FaSnapchat className="size-5" aria-hidden="true" /> },
};
