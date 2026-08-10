import SwiftUI
import WidgetKit

struct DailyEnglishWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: DailyEnglishEntry

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
    VStack(alignment: .leading, spacing: 7) {
      Text("EN")
        .font(.caption2.weight(.black))
        .foregroundStyle(.blue)
      Spacer(minLength: 2)
      Text(entry.expression.sentence)
        .font(.headline.weight(.bold))
        .foregroundStyle(.primary)
        .lineLimit(2)
        .minimumScaleFactor(0.78)
      Text(entry.expression.meaning)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .minimumScaleFactor(0.82)
    }
    .padding(16)
  }

  private var mediumWidget: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("Today’s Expression")
          .font(.caption.weight(.black))
          .foregroundStyle(.blue)
        Spacer()
        Text("🔥 \(entry.expression.streak) days")
          .font(.caption.weight(.bold))
          .foregroundStyle(.secondary)
      }
      Text(entry.expression.sentence)
        .font(.title3.weight(.black))
        .foregroundStyle(.primary)
        .lineLimit(1)
        .minimumScaleFactor(0.82)
      Text(entry.expression.meaning)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
      Text("\(entry.expression.keyword) · \(entry.expression.keywordMeaning)")
        .font(.caption.weight(.bold))
        .foregroundStyle(.purple)
        .lineLimit(1)
    }
    .padding(18)
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
  var body: some View {
    LinearGradient(
      colors: [
        Color(red: 0.96, green: 0.97, blue: 1),
        Color(red: 0.91, green: 0.93, blue: 1)
      ],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }
}
