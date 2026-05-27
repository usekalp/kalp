interface Foo {
  [K in "a" | "b"]: true;
}
