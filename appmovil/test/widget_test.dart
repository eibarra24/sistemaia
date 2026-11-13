import 'package:flutter_test/flutter_test.dart';

import 'package:velocimetro/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const VelocimetroApp());
    expect(find.text('INICIAR'), findsOneWidget);
    expect(find.text('km/h'), findsOneWidget);
  });
}
