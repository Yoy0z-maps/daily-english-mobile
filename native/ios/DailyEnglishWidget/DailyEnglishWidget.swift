import SwiftUI
import WidgetKit

struct DailyEnglishWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  let entry: DailyEnglishEntry

  private var accentColor: Color {
    DailyWidgetPalette.accent(for: colorScheme)
  }

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        smallWidget
      case .systemMedium:
        mediumWidget
      case .accessoryCircular:
        circularWidget
      case .accessoryRectangular:
        rectangularWidget
      case .accessoryInline:
        inlineWidget
      default:
        mediumWidget
      }
    }
    .widgetURL(entry.expression.homeURL)
    .dailyWidgetContainerBackground(for: family)
  }

  private var smallWidget: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 6) {
        Image(systemName: "book.closed.fill")
          .font(.caption2.weight(.bold))
          .foregroundStyle(accentColor)
        Text("오늘의 문장")
          .font(.caption2.weight(.bold))
          .foregroundStyle(.secondary)
        Spacer(minLength: 6)
        levelBadge
      }

      Spacer(minLength: 6)

      Text(entry.expression.sentence)
        .font(.system(size: 18, weight: .bold, design: .rounded))
        .foregroundStyle(.primary)
        .lineLimit(2)
        .minimumScaleFactor(0.76)

      Spacer(minLength: 4)

      Text(entry.expression.meaning)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .minimumScaleFactor(0.82)

      Spacer(minLength: 5)

      HStack(spacing: 5) {
        Image(systemName: "sparkles")
        Text(entry.expression.keyword)
          .lineLimit(1)
      }
      .font(.caption2.weight(.bold))
      .foregroundStyle(accentColor)
    }
    .dailyHomeWidgetPadding(15)
  }

  private var mediumWidget: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 7) {
        Image(systemName: "book.closed.fill")
          .font(.caption.weight(.bold))
          .foregroundStyle(accentColor)
        Text("오늘의 영어")
          .font(.caption.weight(.bold))
          .foregroundStyle(.secondary)
        Spacer(minLength: 8)
        levelBadge
      }

      Spacer(minLength: 6)

      Text(entry.expression.sentence)
        .font(.system(size: 20, weight: .bold, design: .rounded))
        .foregroundStyle(.primary)
        .lineLimit(2)
        .minimumScaleFactor(0.76)

      Spacer(minLength: 4)

      Text(entry.expression.meaning)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.85)

      Spacer(minLength: 6)

      HStack(spacing: 6) {
        Image(systemName: "sparkles")
          .font(.caption2.weight(.bold))
        Text(entry.expression.keyword)
          .font(.caption.weight(.bold))
        Text("·")
          .font(.caption.weight(.bold))
          .foregroundStyle(.secondary)
        Text(entry.expression.keywordMeaning)
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
        Spacer(minLength: 0)
      }
      .foregroundStyle(accentColor)
      .lineLimit(1)
      .padding(.horizontal, 10)
      .padding(.vertical, 5)
      .background(accentColor.opacity(colorScheme == .dark ? 0.16 : 0.11))
      .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
    .dailyHomeWidgetPadding(16)
  }

  private var levelBadge: some View {
    Text(entry.expression.level)
      .font(.system(size: 10, weight: .bold, design: .rounded))
      .foregroundStyle(accentColor)
      .padding(.horizontal, 7)
      .padding(.vertical, 4)
      .background(accentColor.opacity(colorScheme == .dark ? 0.2 : 0.12))
      .clipShape(Capsule())
  }

  private var circularWidget: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 2) {
        Text("EN")
          .font(.caption2.weight(.black))
        Text(entry.expression.streak > 0 ? "🔥\(entry.expression.streak)" : entry.expression.level)
          .font(.caption.weight(.bold))
          .minimumScaleFactor(0.7)
      }
    }
  }

  private var rectangularWidget: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(entry.expression.sentence)
        .font(.headline.weight(.bold))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      Text(entry.expression.meaning)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
  }

  private var inlineWidget: some View {
    Text("EN: \(entry.expression.sentence)")
  }
}

struct DailyEnglishWidget: Widget {
  let kind = "DailyEnglishWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DailyEnglishProvider()) { entry in
      DailyEnglishWidgetView(entry: entry)
    }
    .configurationDisplayName("Daily English")
    .description("오늘의 영어 표현을 홈 화면과 잠금 화면에서 확인하세요.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryInline
    ])
  }
}

private extension View {
  @ViewBuilder
  func dailyHomeWidgetPadding(_ length: CGFloat) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      self
    } else {
      padding(length)
    }
  }

  @ViewBuilder
  func dailyWidgetContainerBackground(for family: WidgetFamily) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      switch family {
      case .systemSmall, .systemMedium:
        containerBackground(for: .widget) {
          DailyWidgetBackgroundGradient()
        }
      default:
        containerBackground(for: .widget) {
          Color.clear
        }
      }
    } else {
      switch family {
      case .systemSmall, .systemMedium:
        background(DailyWidgetBackgroundGradient())
      default:
        self
      }
    }
  }
}

private struct DailyWidgetBackgroundGradient: View {
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    ZStack {
      LinearGradient(
        colors: DailyWidgetPalette.background(for: colorScheme),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      Circle()
        .fill(DailyWidgetPalette.accent(for: colorScheme).opacity(colorScheme == .dark ? 0.12 : 0.1))
        .frame(width: 180, height: 180)
        .offset(x: 100, y: -78)

      Circle()
        .fill(DailyWidgetPalette.purple(for: colorScheme).opacity(colorScheme == .dark ? 0.08 : 0.07))
        .frame(width: 130, height: 130)
        .offset(x: -105, y: 92)
    }
  }
}

private enum DailyWidgetPalette {
  static func accent(for colorScheme: ColorScheme) -> Color {
    colorScheme == .dark
      ? Color(red: 0.50, green: 0.63, blue: 1.00)
      : Color(red: 0.31, green: 0.49, blue: 1.00)
  }

  static func purple(for colorScheme: ColorScheme) -> Color {
    colorScheme == .dark
      ? Color(red: 0.72, green: 0.58, blue: 0.96)
      : Color(red: 0.55, green: 0.36, blue: 0.96)
  }

  static func background(for colorScheme: ColorScheme) -> [Color] {
    if colorScheme == .dark {
      return [
        Color(red: 0.055, green: 0.071, blue: 0.125),
        Color(red: 0.090, green: 0.106, blue: 0.176)
      ]
    }

    return [
      Color(red: 0.969, green: 0.973, blue: 1.000),
      Color(red: 0.933, green: 0.949, blue: 1.000)
    ]
  }
}
