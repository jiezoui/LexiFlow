package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SubtitleParser {

    private static final Pattern TIMELINE = Pattern.compile(
            "(?:(\\d{1,3}):)?(\\d{2}):(\\d{2})[,.](\\d{3})\\s*-->\\s*"
                    + "(?:(\\d{1,3}):)?(\\d{2}):(\\d{2})[,.](\\d{3})(?:\\s+.*)?"
    );

    private SubtitleParser() {
    }

    public static ParsedSubtitle parse(byte[] bytes, int maxCues) {
        String content = new String(bytes, StandardCharsets.UTF_8)
                .replace("\uFEFF", "")
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .trim();
        boolean webVtt = content.startsWith("WEBVTT");
        List<ParsedSubtitleCue> cues = new ArrayList<>();
        for (String block : content.split("\\n\\s*\\n")) {
            String[] lines = block.strip().split("\\n");
            int timelineIndex = -1;
            Matcher matcher = null;
            for (int index = 0; index < lines.length; index++) {
                Matcher candidate = TIMELINE.matcher(lines[index].trim());
                if (candidate.matches()) {
                    timelineIndex = index;
                    matcher = candidate;
                    break;
                }
            }
            if (timelineIndex < 0 || matcher == null) {
                continue;
            }
            long start = timestamp(matcher, 1);
            long end = timestamp(matcher, 5);
            StringBuilder text = new StringBuilder();
            for (int index = timelineIndex + 1; index < lines.length; index++) {
                String line = lines[index].trim();
                if (!line.isEmpty()) {
                    if (!text.isEmpty()) {
                        text.append('\n');
                    }
                    text.append(line);
                }
            }
            String normalized = text.toString().replaceAll("<[^>]+>", "").trim();
            if (start < 0 || end <= start || normalized.isEmpty()) {
                throw new BusinessException(ResultCode.SUBTITLE_INVALID);
            }
            cues.add(new ParsedSubtitleCue(start, end, normalized));
            if (cues.size() > maxCues) {
                throw new BusinessException("字幕条目数量超过限制");
            }
        }
        if (cues.isEmpty()) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
        cues.sort(Comparator.comparingLong(ParsedSubtitleCue::startMs));
        return new ParsedSubtitle(webVtt ? "VTT" : "SRT", List.copyOf(cues));
    }

    private static long timestamp(Matcher matcher, int offset) {
        long hours = matcher.group(offset) == null ? 0 : Long.parseLong(matcher.group(offset));
        long minutes = Long.parseLong(matcher.group(offset + 1));
        long seconds = Long.parseLong(matcher.group(offset + 2));
        long millis = Long.parseLong(matcher.group(offset + 3));
        if (minutes > 59 || seconds > 59) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
        return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + millis;
    }
}
