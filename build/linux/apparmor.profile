abi <abi/4.0>,
include <tunables/global>

profile apex-studios /opt/ApexStudios/apex-studios flags=(unconfined) {
  userns,
  include if exists <local/apex-studios>
}
