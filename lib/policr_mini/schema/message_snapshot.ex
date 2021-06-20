defmodule PolicrMini.Schema.MessageSnapshot do
  @moduledoc """
  消息快照模型。
  """

  use PolicrMini.Schema

  alias PolicrMini.Schema.Chat

  @required_fields ~w(chat_id message_id from_user_id from_user_name date)a
  @optional_fields ~w(text photo_id caption markup_body attachment)a

  schema "message_snapshots" do
    belongs_to :chat, Chat

    field :message_id, :integer
    field :from_user_id, :integer
    field :from_user_name, :string
    field :date, :integer
    field :text, :string
    field :photo_id, :string
    field :caption, :string
    field :markup_body, :string
    field :attachment, :string

    timestamps()
  end

  @type t :: map()

  def changeset(%__MODULE__{} = message_snapshot, attrs) when is_map(attrs) do
    message_snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> assoc_constraint(:chat)
  end
end
