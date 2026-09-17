package com.lexiflow.modules.media.util;

import java.util.List;

public record ParsedSubtitle(String format, List<ParsedSubtitleCue> cues) {
}
