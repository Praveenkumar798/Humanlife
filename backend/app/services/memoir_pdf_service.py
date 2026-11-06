"""
Human Legacy AI - Printable Memoir Book PDF Generator

Generates a publication-grade, hardcover-style personal autobiography book (PDF)
from the user's stored memories, milestones, photos, and philosophical lessons.
"""

import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, asc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
    PageBreak,
    KeepTogether,
    Table,
    TableStyle,
)
from reportlab.pdfgen import canvas

from app.models.user import User
from app.models.memory import Memory


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print 'Page X of Y' page numbers
    and elegant running headers on all pages except the cover.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        # Do not print running headers or footers on Cover Page (Page 1)
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header
        self.drawString(54, letter[1] - 36, "THE LIFE & LEGACY MEMOIR ARCHIVE")
        self.drawRightString(letter[0] - 54, letter[1] - 36, "HUMAN LEGACY AI")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)

        # Running Footer
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(letter[0] - 54, 34, page_str)
        self.drawString(54, 34, "Permanent Cognitive Memory Vault • Preserved for Posterity")
        self.line(54, 46, letter[0] - 54, 46)

        self.restoreState()


async def generate_memoir_book_pdf(
    db: AsyncSession,
    user_id: uuid.UUID,
    user: User,
    book_title: Optional[str] = None,
    include_prologue: bool = True,
) -> bytes:
    """
    Query all memories owned by the user, ordered chronologically,
    and render a formatted hardcover-style memoir book PDF.
    """
    # 1. Fetch memories sorted by event_date (or created_at fallback)
    stmt = (
        select(Memory)
        .where(Memory.user_id == user_id)
        .order_by(
            Memory.event_date.asc().nulls_last(),
            Memory.created_at.asc(),
        )
    )
    result = await db.execute(stmt)
    memories: List[Memory] = result.scalars().all()

    if not memories:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cannot export Legacy Book: No memories recorded in vault yet. Record at least one memory first.",
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    # 2. Typography Styles
    base_styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CoverTitle",
        parent=base_styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,  # Center
        spaceAfter=12,
    )

    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#475569"),
        alignment=1,
        spaceAfter=24,
    )

    h1_style = ParagraphStyle(
        "ChapterHeader",
        parent=base_styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True,
    )

    meta_style = ParagraphStyle(
        "ChapterMeta",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#6366f1"),
        spaceAfter=12,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "ChapterBody",
        parent=base_styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=16,
        textColor=colors.HexColor("#334155"),
        spaceAfter=10,
    )

    prologue_style = ParagraphStyle(
        "PrologueStyle",
        parent=base_styles["Italic"],
        fontName="Helvetica-Oblique",
        fontSize=11.5,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        alignment=1,
    )

    story = []

    # =========================================================================
    # 1. COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 100))
    story.append(
        HRFlowable(
            width="80%",
            thickness=3,
            color=colors.HexColor("#6366f1"),
            spaceBefore=0,
            spaceAfter=24,
            hAlign="CENTER",
        )
    )

    display_name = user.full_name or user.username or "Family Legacy"
    final_book_title = book_title or f"The Memoir & Life Legacy of {display_name}"

    story.append(Paragraph(final_book_title.upper(), title_style))
    story.append(
        Paragraph(
            "An Heirloom Chronicle of Lived Experiences, Foundational Values & Defining Moments",
            subtitle_style,
        )
    )

    story.append(
        HRFlowable(
            width="40%",
            thickness=1,
            color=colors.HexColor("#cbd5e1"),
            spaceBefore=10,
            spaceAfter=30,
            hAlign="CENTER",
        )
    )

    story.append(Spacer(1, 140))

    # Archival seal info at bottom of cover
    curation_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
    cover_meta_text = (
        f"<b>Archivist Record:</b> {len(memories)} Preserved Chapters<br/>"
        f"<b>Compiled On:</b> {curation_date}<br/>"
        f"<b>Grounding Vault:</b> Human Legacy AI Cognitive Replica"
    )
    story.append(Paragraph(cover_meta_text, ParagraphStyle("CoverFooter", parent=subtitle_style, fontSize=9.5, leading=14)))

    story.append(PageBreak())

    # =========================================================================
    # 2. PROLOGUE & DEDICATION
    # =========================================================================
    if include_prologue:
        story.append(Spacer(1, 40))
        story.append(Paragraph("PROLOGUE & DEDICATION", h1_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=24))

        prologue_text = (
            f"<i>&ldquo;To my family, my descendants, and future generations:<br/><br/>"
            f"A life is not measured merely in elapsed days, but in the memories we cherished, "
            f"the hardships we endured, the love we shared, and the principles we upheld when tested.<br/><br/>"
            f"I have preserved these words so that you may know where you came from, what lessons guided my steps, "
            f"and what love lives forever in my heart for you. May these pages offer you guidance, laughter, and courage "
            f"on your own journey.&rdquo;</i><br/><br/>"
            f"<b>&mdash; {display_name}</b>"
        )
        story.append(Paragraph(prologue_text, prologue_style))
        story.append(PageBreak())

    # =========================================================================
    # 3. TABLE OF CONTENTS
    # =========================================================================
    story.append(Paragraph("TABLE OF CONTENTS", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=18))

    toc_data = [["Chapter", "Era / Title", "Milestone Date"]]
    for idx, mem in enumerate(memories, start=1):
        ch_num = f"Chapter {idx}"
        dt = mem.event_date.strftime("%B %Y") if mem.event_date else "Recorded Memory"
        title_summary = mem.title[:45] + ("..." if len(mem.title) > 45 else "")
        toc_data.append([ch_num, title_summary, dt])

    toc_table = Table(toc_data, colWidths=[80, 310, 114])
    toc_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#334155")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#6366f1")),
                ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ]
        )
    )
    story.append(toc_table)
    story.append(PageBreak())

    # =========================================================================
    # 4. CHRONOLOGICAL CHAPTERS
    # =========================================================================
    for idx, mem in enumerate(memories, start=1):
        ch_title = f"CHAPTER {idx}: {mem.title.upper()}"
        story.append(Paragraph(ch_title, h1_style))

        # Metadata bar
        date_str = mem.event_date.strftime("%B %d, %Y") if mem.event_date else "Date Unknown"
        importance_str = f"Significance: {mem.importance}/10" if mem.importance else ""
        source_label = "PHOTO ARCHIVE" if mem.source_type == "photo" else mem.source_type.upper()
        meta_line = f"{date_str} &bull; {mem.category or 'General'} &bull; {source_label} {('&bull; ' + importance_str) if importance_str else ''}"
        story.append(Paragraph(meta_line, meta_style))

        story.append(
            HRFlowable(
                width="100%",
                thickness=0.5,
                color=colors.HexColor("#e2e8f0"),
                spaceBefore=2,
                spaceAfter=14,
            )
        )

        # Body prose (split by newlines into paragraphs)
        paragraphs = mem.content.strip().split("\n\n")
        for p in paragraphs:
            clean_p = p.strip()
            if clean_p:
                story.append(Paragraph(clean_p, body_style))

        # Tags footnote
        if mem.tags and isinstance(mem.tags, list):
            tags_str = " &bull; ".join([f"#{t}" for t in mem.tags[:6]])
            story.append(Spacer(1, 6))
            story.append(
                Paragraph(
                    f"<i>Themes: {tags_str}</i>",
                    ParagraphStyle("Tags", parent=body_style, fontSize=8.5, textColor=colors.HexColor("#64748b")),
                )
            )

        story.append(Spacer(1, 18))
        # Chapter separator divider
        story.append(
            HRFlowable(
                width="30%",
                thickness=1,
                color=colors.HexColor("#cbd5e1"),
                spaceBefore=10,
                spaceAfter=24,
                hAlign="CENTER",
            )
        )

    # =========================================================================
    # 5. EPILOGUE & ARCHIVAL COLOPHON
    # =========================================================================
    story.append(PageBreak())
    story.append(Spacer(1, 40))
    story.append(Paragraph("EPILOGUE & ARCHIVAL COLOPHON", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=18))

    colophon_text = (
        f"This document represents the official compiled autobiography of <b>{display_name}</b>, "
        f"curated via the Human Legacy AI Cognitive Preservation Platform.<br/><br/>"
        f"All {len(memories)} chapters herein were verified, transcribed, and indexed using dense 768-dimensional "
        f"vector representations with Google Gemini LLM grounding. This printed volume ensures these memories survive "
        f"beyond digital platforms and remain directly in the hands of future generations.<br/><br/>"
        f"<i>Generated on {curation_date} &bull; Immutable Legacy Archive Seal</i>"
    )
    story.append(Paragraph(colophon_text, body_style))

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()

