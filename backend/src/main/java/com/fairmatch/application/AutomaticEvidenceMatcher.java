package com.fairmatch.application;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** A reproducible first-pass comparison of job wording with submitted application text. */
final class AutomaticEvidenceMatcher {
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]+");
    private static final Pattern PASSAGE = Pattern.compile("(?<=[.!?;\\n])\\s+");
    private static final Set<String> STOP = Set.of("a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "is", "of", "on", "or", "the", "to", "with", "you", "your", "our", "must", "have", "has", "will", "can", "should", "required", "relevant", "good", "strong", "ability", "knowledge", "experience");
    record Evidence(String field, String text) {}
    record Match(String requirement, int weight, List<String> matchedWords, int totalTerms, String source, String excerpt, double points) {}
    record Result(double score, int matched, List<Match> matches) {}

    private AutomaticEvidenceMatcher() {}

    static Result compare(List<String> requirements, List<Integer> weights, List<Evidence> evidence) {
        if (requirements.size() != weights.size()) throw new IllegalArgumentException("Each requirement needs one weight.");
        var matches = new ArrayList<Match>();
        double total = 0;
        int found = 0;
        for (int index = 0; index < requirements.size(); index++) {
            var terms = terms(requirements.get(index));
            int best = 0;
            Set<String> bestWords = Set.of();
            String source = "none", excerpt = "";
            for (var item : evidence) {
                if (item.text() == null || item.text().isBlank()) continue;
                for (var passage : PASSAGE.split(item.text())) {
                    var overlap = new HashSet<>(terms);
                    overlap.retainAll(terms(passage));
                    if (overlap.size() > best) {
                        best = overlap.size();
                        bestWords = overlap;
                        source = item.field();
                        excerpt = isSkillList(item.field()) ? item.text().strip() : excerpt(passage, overlap);
                    }
                }
            }
            if (best > 0) found++;
            double points = terms.isEmpty() ? 0 : round((double) weights.get(index) * best / terms.size());
            total += points;
            matches.add(new Match(requirements.get(index), weights.get(index), bestWords.stream().sorted().toList(), terms.size(), source, excerpt, points));
        }
        return new Result(round(total), found, matches);
    }

    private static Set<String> terms(String value) {
        var result = new LinkedHashSet<String>();
        var matcher = WORD.matcher(Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFKC));
        while (matcher.find()) {
            var word = matcher.group();
            if (word.length() > 1 && !STOP.contains(word)) result.add(word);
        }
        return result;
    }

    private static String excerpt(String passage, Set<String> matched) {
        var matcher = WORD.matcher(passage);
        int position = 0;
        while (matcher.find()) if (matched.contains(matcher.group().toLowerCase(Locale.ROOT))) { position = matcher.start(); break; }
        int start = Math.max(0, position - 70);
        int end = Math.min(passage.length(), start + 240);
        return (start > 0 ? "…" : "") + passage.substring(start, end).strip() + (end < passage.length() ? "…" : "");
    }

    private static boolean isSkillList(String field) {
        return "skills".equals(field) || "cv_skills".equals(field);
    }

    private static double round(double value) { return Math.round(value * 100) / 100.0; }
}
