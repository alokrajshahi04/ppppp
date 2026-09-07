// Tolti AI · inline icon set (stroke 1.5, 16px grid — no icon packs)
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            {...rest}
        >
            {children}
        </svg>
    );
}

export const IconPlus = (p: P) => (
    <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>
);

export const IconLock = (p: P) => (
    <Svg {...p}><rect x="3.5" y="7" width="9" height="6" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></Svg>
);

export const IconChat = (p: P) => (
    <Svg {...p}><path d="M13.5 8a5.5 5.5 0 0 1-8.1 4.8L2.5 13.5l.7-2.9A5.5 5.5 0 1 1 13.5 8Z" /></Svg>
);

export const IconFolder = (p: P) => (
    <Svg {...p}><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" /></Svg>
);

export const IconGrid = (p: P) => (
    <Svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></Svg>
);

export const IconPulse = (p: P) => (
    <Svg {...p}><path d="M1.5 8.5h3l1.5-4 2.5 7 1.5-3h4.5" /></Svg>
);

export const IconDoc = (p: P) => (
    <Svg {...p}><path d="M4 1.8h5.2L12.5 5v8.2a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1Z" /><path d="M9 2v3.2h3.4" /></Svg>
);

export const IconCode = (p: P) => (
    <Svg {...p}><path d="m5.5 4.5-3 3.5 3 3.5M10.5 4.5l3 3.5-3 3.5" /></Svg>
);

export const IconSpark = (p: P) => (
    <Svg {...p}><path d="M8 1.8 9.3 6 13.5 7.3 9.3 8.6 8 12.8 6.7 8.6 2.5 7.3 6.7 6 8 1.8Z" /><path d="M12.8 11.5l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5.5-1.6Z" strokeWidth={1.1} /></Svg>
);

export const IconChevronDown = (p: P) => (
    <Svg {...p}><path d="m4 6 4 4 4-4" /></Svg>
);

export const IconChevronRight = (p: P) => (
    <Svg {...p}><path d="m6 4 4 4-4 4" /></Svg>
);

export const IconPaperclip = (p: P) => (
    <Svg {...p}><path d="M10.8 4.2 5.6 9.4a1.9 1.9 0 0 0 2.7 2.7l5-5a3.1 3.1 0 0 0-4.4-4.4l-5 5a4.4 4.4 0 0 0 6.2 6.2l4.4-4.4" transform="scale(0.86) translate(1.2 1.2)" /></Svg>
);

export const IconArrowUp = (p: P) => (
    <Svg {...p}><path d="M8 13V3M3.8 7.2 8 3l4.2 4.2" /></Svg>
);

export const IconSend = (p: P) => (
    <Svg {...p}><path d="M2.5 8 13.5 2.8 11 13.2 8 9.5l-5.5-1.5Z" /><path d="M8 9.5 13.5 2.8" /></Svg>
);

export const IconSwap = (p: P) => (
    <Svg {...p}><path d="M2.5 5h9.5M9.8 2.8 12 5 9.8 7.2M13.5 11H4M6.2 8.8 4 11l2.2 2.2" /></Svg>
);

export const IconBell = (p: P) => (
    <Svg {...p}><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1.5H3l1-1.5Z" /><path d="M6.6 13a1.6 1.6 0 0 0 2.8 0" /></Svg>
);

export const IconAlert = (p: P) => (
    <Svg {...p}><path d="M8 2.2 14.3 13H1.7L8 2.2Z" /><path d="M8 6.4v3" /><circle cx="8" cy="11.2" r="0.4" fill="currentColor" stroke="none" /></Svg>
);

export const IconCheck = (p: P) => (
    <Svg {...p}><path d="m3 8.5 3.2 3L13 4.5" /></Svg>
);

export const IconX = (p: P) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
);

export const IconDownload = (p: P) => (
    <Svg {...p}><path d="M8 2.5v8M4.8 7.3 8 10.5l3.2-3.2M3 13.5h10" /></Svg>
);

export const IconUpload = (p: P) => (
    <Svg {...p}><path d="M8 10.5v-8M4.8 5.7 8 2.5l3.2 3.2M3 13.5h10" /></Svg>
);

export const IconTrash = (p: P) => (
    <Svg {...p}><path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5 5 13a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.5-8.5" /></Svg>
);

export const IconUsers = (p: P) => (
    <Svg {...p}><circle cx="6" cy="5.5" r="2.3" /><path d="M2.2 13c.4-2.4 1.9-3.6 3.8-3.6s3.4 1.2 3.8 3.6" /><path d="M10.5 3.6a2.1 2.1 0 0 1 .3 4.1M11.5 9.6c1.3.4 2.1 1.5 2.4 3" /></Svg>
);

export const IconCpu = (p: P) => (
    <Svg {...p}><rect x="4" y="4" width="8" height="8" rx="1.5" /><path d="M6.5 1.8v2.2M9.5 1.8v2.2M6.5 12v2.2M9.5 12v2.2M1.8 6.5H4M1.8 9.5H4M12 6.5h2.2M12 9.5h2.2" /></Svg>
);

export const IconHome = (p: P) => (
    <Svg {...p}><path d="m2.5 7.5 5.5-5 5.5 5M4 6.8V13a.8.8 0 0 0 .8.8h6.4a.8.8 0 0 0 .8-.8V6.8" /></Svg>
);

export const IconSearch = (p: P) => (
    <Svg {...p}><circle cx="7" cy="7" r="4.2" /><path d="m10.4 10.4 3.1 3.1" /></Svg>
);
